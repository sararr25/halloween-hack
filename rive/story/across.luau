-- S9 · the window across, drawn from the real photo of the terrace (round 9; the IMG_0413
-- view, rive/photo/plate_*.jpg). Scene units are the photo's own pixels (1536 x 1024).
-- 1. The photo as an image mesh: each vertex is pushed by the player's head according to how
--    near that part of the street is (the facade far, the garden walls, cars and the wet
--    road nearer), so the street shifts in perspective like a view through a real window.
--    The lit window (4A) is the anchor, so the figure layer in Reveal.tsx stays glued to it.
-- 2. window_across.wgsl layer 0, "screen": the light in 4A, its spill, its reflection on the
--    wet road, the lamp's bloom.
-- 3. The figure in 4A is not drawn here: it is a rigged 3D person (lib/figure3d.ts) drawn by
--    Reveal.tsx over this canvas, with the window's bars and curtain in front of it.
-- 4. Under corruption, torn strips of the photo slide sideways.
-- 5. window_across.wgsl layer 1: rain, vignette, grain, scanline tears.
-- The host writes across/headX, headY, zoom, light, corruption, figure, neon.
type Across = {
    across: Input<Data.Across>?,
    plate: Image?,
    light: GPUCanvas?,
    top: GPUCanvas?,
    pipeline: GPUPipeline?,
    lightUbo: GPUBuffer?,
    topUbo: GPUBuffer?,
    lightGroup: GPUBindGroup?,
    topGroup: GPUBindGroup?,
    vertices: VertexBuffer,
    uvs: VertexBuffer,
    triangles: TriangleBuffer,
    data: buffer,
    sampler: ImageSampler,
    time: number,
    size: Vector,
}

local SCENE_W = 1536
local SCENE_H = 1024
-- the lit window, centre of its glass (photo px); keep in sync with window_across.wgsl, Reveal.tsx
local LIT_X = 914
local LIT_Y = 362
local COLS = 32
local ROWS = 22
-- how far the nearest part of the street travels when the head is fully turned (photo px)
local PARALLAX = 46
local function v(self: Across, name: string): number
    local a = self.across
    if a == nil then
        return 0
    end
    if name == "headX" then return a.headX.value end
    if name == "headY" then return a.headY.value end
    if name == "zoom" then return a.zoom.value end
    if name == "light" then return a.light.value end
    if name == "corruption" then return a.corruption.value end
    if name == "figure" then return a.figure.value end
    return a.neon.value
end

-- how near each part of the photo is, 0 (the facade, the roofs) .. 1 (the road at the bottom)
local function nearness(y: number): number
    local t = math.clamp((y - 640) / (1024 - 640), 0, 1)
    return t * t * (3 - 2 * t)
end

function init(self: Across, context: Context): boolean
    self.plate = context:image("plate_sharp")
    local shader = context:shader("window_across")
    self.light = context:gpuCanvas()
    self.top = context:gpuCanvas()
    -- the mesh's triangles never change, only where its vertices land
    for r = 0, ROWS - 1 do
        for c = 0, COLS - 1 do
            local i = r * (COLS + 1) + c
            self.triangles:add(i, i + 1, i + COLS + 1)
            self.triangles:add(i + 1, i + COLS + 2, i + COLS + 1)
        end
    end
    if shader == nil or self.light == nil or self.top == nil then
        return true
    end
    local light = self.light :: GPUCanvas
    local pipeline = GPUPipeline.new({
        vertex = shader,
        fragment = shader,
        vertexLayout = {},
        colorTargets = { { format = light.format } },
    })
    self.pipeline = pipeline
    local lightUbo = GPUBuffer.new({ size = 64, usage = "uniform" })
    local topUbo = GPUBuffer.new({ size = 64, usage = "uniform" })
    self.lightUbo = lightUbo
    self.topUbo = topUbo
    self.lightGroup = GPUBindGroup.new({ layout = pipeline:getBindGroupLayout(0), ubos = { { slot = 0, buffer = lightUbo } } })
    self.topGroup = GPUBindGroup.new({ layout = pipeline:getBindGroupLayout(0), ubos = { { slot = 0, buffer = topUbo } } })
    return true
end

function resize(self: Across, size: Vector)
    self.size = size
    if size.x <= 0 or size.y <= 0 then
        return
    end
    if self.light then
        (self.light :: GPUCanvas):resize(math.ceil(size.x), math.ceil(size.y))
    end
    if self.top then
        (self.top :: GPUCanvas):resize(math.ceil(size.x), math.ceil(size.y))
    end
end

function advance(self: Across, seconds: number): boolean
    self.time += seconds
    return true
end

local function render(self: Across, canvas: GPUCanvas, ubo: GPUBuffer, group: GPUBindGroup, layer: number)
    local d = self.data
    buffer.writef32(d, 0, self.time)
    buffer.writef32(d, 4, canvas.width)
    buffer.writef32(d, 8, canvas.height)
    buffer.writef32(d, 12, v(self, "headX"))
    buffer.writef32(d, 16, v(self, "headY"))
    buffer.writef32(d, 20, v(self, "zoom"))
    buffer.writef32(d, 24, v(self, "light"))
    buffer.writef32(d, 28, v(self, "corruption"))
    buffer.writef32(d, 32, v(self, "figure"))
    buffer.writef32(d, 36, v(self, "neon"))
    buffer.writef32(d, 40, 0)
    buffer.writef32(d, 44, layer)
    ubo:write(d)
    local pass = canvas:beginRenderPass({
        color = { { loadOp = "clear", storeOp = "store", clearColor = { 0, 0, 0, 0 } } },
    })
    pass:setPipeline(self.pipeline :: GPUPipeline)
    pass:setBindGroup(0, group)
    pass:draw(3)
    pass:finish()
end

function draw(self: Across, renderer: Renderer)
    local plate = self.plate
    if plate == nil or self.size.x <= 0 then
        return
    end
    -- photo px -> artboard units: cover the artboard, push in on the lit window, a hand-held
    -- drift (the same maths as window_across.wgsl and Reveal.tsx)
    local cover = math.max(self.size.x / SCENE_W, self.size.y / SCENE_H)
    local zoom = v(self, "zoom")
    local z = 1 + 4.2 * zoom * zoom
    local s = cover * z
    local drift = math.sin(self.time * 0.37) * 1.5 / z
    local cx = self.size.x / 2 + (LIT_X - SCENE_W / 2) * cover
    local cy = self.size.y / 2 + (LIT_Y - SCENE_H / 2) * cover
    local hx = v(self, "headX")
    local hy = v(self, "headY")

    -- 1 · the photo, as a mesh that bends with the head
    self.vertices:reset()
    self.uvs:reset()
    for r = 0, ROWS do
        for c = 0, COLS do
            local px = c / COLS * SCENE_W
            local py = r / ROWS * SCENE_H
            local n = nearness(py)
            -- the near street moves against the head, the far facade stays (motion parallax)
            local ox = -hx * PARALLAX * n
            local oy = -hy * PARALLAX * 0.35 * n
            self.vertices:add(Vector.xy(cx + (px + ox - LIT_X + drift) * s, cy + (py + oy - LIT_Y) * s))
            self.uvs:add(Vector.xy(c / COLS, r / ROWS))
        end
    end
    renderer:drawImageMesh(plate, self.sampler, self.vertices, self.uvs, self.triangles, "srcOver", 1)

    local light = self.light
    local top = self.top
    local ready = self.pipeline ~= nil and light ~= nil and top ~= nil and (light :: GPUCanvas).width > 0
    if ready then
        render(self, light :: GPUCanvas, self.lightUbo :: GPUBuffer, self.lightGroup :: GPUBindGroup, 0)
        renderer:drawImage((light :: GPUCanvas).image, self.sampler, "screen", 1)
    end

    -- 3 · corruption: strips of the photo torn sideways, a different few every tenth of a second
    local corruption = v(self, "corruption")
    if corruption > 0.01 then
        local tick = math.floor(self.time * 10)
        for i = 0, 13 do
            local h = (math.sin(tick * 12.9898 + i * 78.233) * 43758.5453) % 1
            if h < corruption * 0.6 then
                local y0 = (i / 14) * self.size.y
                local y1 = y0 + self.size.y / 14 * (0.4 + h)
                local shift = ((h * 7.31) % 1 - 0.5) * 260 * corruption
                local strip = Path.new()
                strip:moveTo(Vector.xy(0, y0))
                strip:lineTo(Vector.xy(self.size.x, y0))
                strip:lineTo(Vector.xy(self.size.x, y1))
                strip:lineTo(Vector.xy(0, y1))
                strip:close()
                renderer:save()
                renderer:clipPath(strip)
                renderer:transform(Mat2D.withTranslation(shift, 0))
                renderer:drawImageMesh(plate, self.sampler, self.vertices, self.uvs, self.triangles, "srcOver", 1)
                renderer:restore()
            end
        end
    end

    -- 4 · rain, vignette, grain
    if ready then
        render(self, top :: GPUCanvas, self.topUbo :: GPUBuffer, self.topGroup :: GPUBindGroup, 1)
        renderer:drawImage((top :: GPUCanvas).image, self.sampler, "srcOver", 1)
    end
end

return function(context: Context): Layout<Across>
    return {
        across = nil,
        plate = nil,
        light = nil,
        top = nil,
        pipeline = nil,
        lightUbo = nil,
        topUbo = nil,
        lightGroup = nil,
        topGroup = nil,
        vertices = VertexBuffer(),
        uvs = VertexBuffer(),
        triangles = TriangleBuffer(),
        data = buffer.create(64),
        sampler = ImageSampler("clamp", "clamp", "bilinear"),
        time = 0,
        size = Vector.xy(0, 0),
        init = init,
        resize = resize,
        advance = advance,
        draw = draw,
    }
end
