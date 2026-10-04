-- S9 · the window across, drawn from the real photo of the terrace (round 9; the IMG_0413
-- view, rive/photo/plate_*.jpg). Scene units are the photo's own pixels (1536 x 1024).
-- 1. The photo as an image mesh: each vertex is pushed by the player's head according to how
--    near that part of the street is (the facade far, the garden walls, cars and the wet
--    road nearer), so the street shifts in perspective like a view through a real window.
--    The lit window (4A) is the anchor, so the figure layer in Reveal.tsx stays glued to it.
-- 2. window_across.wgsl layer 0, "screen": the light in 4A, its spill, its reflection on the
--    wet road, the lamp's bloom.
-- 3. The figure in 4A (owner, round 10): the owner's backlit silhouette, made unisex
--    (short hair) and cut into pieces by scripts/make-figure.py: body, head, forearm with
--    the hand. Clipped to the glass, standing to below the sill, blurred while the camera is
--    far and sharp as it pushes in. The head copies the player's head; the forearm turns
--    about the elbow (which lifts when the hand is out of reach) so the hand is where the
--    player's is (armX, armY: the palm from the nose in face widths, mirrored); on the
--    other side it hangs. Then the window bars and the sheer curtain over it.
-- 4. Under corruption, torn strips of the photo slide sideways.
-- 5. window_across.wgsl layer 1: rain, vignette, grain, scanline tears.
-- The host writes across/headX, headY, zoom, light, corruption, figure, neon, armX, armY.
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
    figBody: Image?,
    figHead: Image?,
    figArm: Image?,
    figBodySoft: Image?,
    figHeadSoft: Image?,
    figArmSoft: Image?,
    clip: Path,
    bars: Path,
    curtain: Path,
    shade: Path,
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
-- the glass of 4A (photo px); keep in sync with window_across.wgsl
local GLASS = { x0 = 884, y0 = 300, x1 = 944, y1 = 424 }
-- The figure. Its pieces (scripts/make-figure.py) are drawn at 916 x 1145 and saved at half
-- that ("sharp") and an eighth, padded ("soft"); every number below is in those 916-scale
-- px, turned into photo px by FIG_K. The neck (457, 575) stands at NECK in the photo.
local FIG_K = 0.0454
local NECK = Vector.xy(912, 339)
local PAD = 64 -- sharp px around a soft piece
local BODY_AT = Vector.xy(434, 39) -- the neck, in the body piece
local HEAD_AT = Vector.xy(295, 517) -- the neck, in the head piece
local ARM_AT = Vector.xy(153, 671) -- the elbow, in the forearm piece
-- the right elbow from the neck, and the hand's centre from the elbow, as drawn
local ELBOW = Vector.xy(369, 410)
local HAND = Vector.xy(-36, -555)
-- the nose from the neck, and a face width: the unit of armX, armY
local NOSE = Vector.xy(0, -175)
local FACE_W = 300
-- how far the elbow may lift towards a hand out of reach (916-scale px)
local ELBOW_LIFT = 120

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
    if name == "neon" then return a.neon.value end
    if name == "armX" then return a.armX.value end
    return a.armY.value
end

-- how near each part of the photo is, 0 (the facade, the roofs) .. 1 (the road at the bottom)
local function nearness(y: number): number
    local t = math.clamp((y - 640) / (1024 - 640), 0, 1)
    return t * t * (3 - 2 * t)
end

function init(self: Across, context: Context): boolean
    self.plate = context:image("plate_sharp")
    self.figBody = context:image("fig_body")
    self.figHead = context:image("fig_head")
    self.figArm = context:image("fig_arm")
    self.figBodySoft = context:image("fig_body_soft")
    self.figHeadSoft = context:image("fig_head_soft")
    self.figArmSoft = context:image("fig_arm_soft")
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

local function box(p: Path, x0: number, y0: number, x1: number, y1: number)
    p:moveTo(Vector.xy(x0, y0))
    p:lineTo(Vector.xy(x1, y0))
    p:lineTo(Vector.xy(x1, y1))
    p:lineTo(Vector.xy(x0, y1))
    p:close()
end

-- one piece, its anchor placed at `at` (a transform in 916-scale px), sharp over soft by `near`
local function piece(self: Across, renderer: Renderer, at: Mat2D, sharp: Image?, soft: Image?, anchor: Vector, alpha: number, near: number)
    local softA = math.clamp(2 - 2 * near, 0, 1) * alpha
    local sharpA = math.clamp(2 * near, 0, 1) * alpha
    if soft ~= nil and softA > 0.004 then
        renderer:save()
        renderer:transform(at * Mat2D.withScale(8, 8) * Mat2D.withTranslation(-(anchor.x / 2 + PAD) / 4, -(anchor.y / 2 + PAD) / 4))
        renderer:drawImage(soft, self.sampler, "srcOver", softA)
        renderer:restore()
    end
    if sharp ~= nil and sharpA > 0.004 then
        renderer:save()
        renderer:transform(at * Mat2D.withScale(2, 2) * Mat2D.withTranslation(-anchor.x / 2, -anchor.y / 2))
        renderer:drawImage(sharp, self.sampler, "srcOver", sharpA)
        renderer:restore()
    end
end

local function figure(self: Across, renderer: Renderer, toScreen: Mat2D, alpha: number, near: number)
    local hx = v(self, "headX")
    local hy = v(self, "headY")
    -- in photo px from here on (the glass clips), the pieces in 916-scale px from the neck.
    -- The body leans a little into the turn and breathes, barely; the head goes where the
    -- player's goes.
    self.clip:reset()
    self.bars:reset()
    self.curtain:reset()
    self.shade:reset()
    renderer:save()
    renderer:transform(toScreen)
    box(self.clip, GLASS.x0, GLASS.y0, GLASS.x1, GLASS.y1)
    renderer:clipPath(self.clip)
    local breathe = math.sin(self.time * 1.6)
    local body = Mat2D.withTranslation(NECK.x, NECK.y) * Mat2D.withScale(FIG_K, FIG_K) * Mat2D.withTranslation(hx * 30, breathe * 4)
    local head = body * Mat2D.withTranslation(hx * 50, hy * 30) * Mat2D.withRotation(hx * 0.14)
    piece(self, renderer, body, self.figBody, self.figBodySoft, BODY_AT, alpha, near)
    piece(self, renderer, head, self.figHead, self.figHeadSoft, HEAD_AT, alpha, near)

    -- the forearms: the hand goes where the player's is; the other one hangs at rest
    local want = Vector.xy(v(self, "armX"), v(self, "armY"))
    local reach = Vector.length(HAND)
    for _, side in { -1, 1 } do
        local mine = (want.x >= 0) == (side > 0)
        local elbow = Vector.xy(ELBOW.x * side, ELBOW.y)
        local target = if mine then NOSE + want * FACE_W else elbow + Vector.xy(0, reach)
        local d = target - elbow
        local dist = Vector.length(d)
        -- out of reach: the upper arm lifts the elbow towards it, a little
        if dist > reach then
            elbow = elbow + Vector.normalized(d) * math.min(dist - reach, ELBOW_LIFT)
            d = target - elbow
            dist = Vector.length(d)
        end
        local dir = Vector.normalized(d)
        -- pointing down it is part of the body; it shows as it comes up and out
        local show = math.clamp((0.45 - dir.y) / 0.6, 0, 1)
        if show > 0.004 then
            -- the drawn forearm points along HAND (mirrored on the left): turn it onto dir,
            -- a little shorter when the hand is nearer than the arm is long
            local turn = math.atan2(dir.y, dir.x) - math.atan2(HAND.y, HAND.x * side)
            local stretch = math.clamp(dist / reach, 0.82, 1.04)
            local at = body * Mat2D.withTranslation(elbow.x, elbow.y) * Mat2D.withRotation(turn) * Mat2D.withScale(side, stretch)
            piece(self, renderer, at, self.figArm, self.figArmSoft, ARM_AT, alpha * show, near)
        end
    end

    -- the bulb is high: the bottom of the room, and of whoever stands in it, falls dark
    box(self.shade, GLASS.x0, 360, GLASS.x1, GLASS.y1)
    renderer:drawPath(self.shade, Paint.with({
        style = "fill",
        gradient = Gradient.linear(Vector.xy(0, 360), Vector.xy(0, GLASS.y1), {
            { position = 0, color = Color.rgba(4, 5, 7, 0) },
            { position = 1, color = Color.rgba(4, 5, 7, math.floor(200 * alpha)) },
        }),
    }))

    -- in front: the sheer curtain on the left, catching the light, and the bars
    box(self.curtain, GLASS.x0, GLASS.y0, GLASS.x0 + 24, GLASS.y1)
    local light = v(self, "light")
    renderer:drawPath(self.curtain, Paint.with({
        style = "fill",
        gradient = Gradient.linear(Vector.xy(GLASS.x0, 0), Vector.xy(GLASS.x0 + 24, 0), {
            { position = 0, color = Color.rgba(216, 220, 229, math.floor(46 * light)) },
            { position = 0.7, color = Color.rgba(216, 220, 229, math.floor(30 * light)) },
            { position = 1, color = Color.rgba(216, 220, 229, 0) },
        }),
    }))
    box(self.bars, GLASS.x0 + 28.8, GLASS.y0, GLASS.x0 + 31.2, GLASS.y1)
    box(self.bars, GLASS.x0, GLASS.y0 + 58.8, GLASS.x1, GLASS.y0 + 61.2)
    renderer:drawPath(self.bars, Paint.with({ color = Color.rgba(8, 9, 11, 230), style = "fill" }))
    renderer:restore()
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

    -- 3 · the figure: soft while the camera is far, sharp as it reaches the window
    local alpha = v(self, "figure") * math.min(v(self, "light"), 1 - v(self, "corruption"))
    if alpha > 0.005 then
        local near = math.clamp((zoom - 0.25) / 0.7, 0, 1)
        near = near * near * (3 - 2 * near)
        local toScreen = Mat2D.withTranslation(cx, cy) * Mat2D.withScale(s, s) * Mat2D.withTranslation(-LIT_X + drift, -LIT_Y)
        figure(self, renderer, toScreen, alpha, near)
    end

    -- 4 · corruption: strips of the photo torn sideways, a different few every tenth of a second
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

    -- 5 · rain, vignette, grain
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
        figBody = nil,
        figHead = nil,
        figArm = nil,
        figBodySoft = nil,
        figHeadSoft = nil,
        figArmSoft = nil,
        clip = Path.new(),
        bars = Path.new(),
        curtain = Path.new(),
        shade = Path.new(),
        init = init,
        resize = resize,
        advance = advance,
        draw = draw,
    }
end
