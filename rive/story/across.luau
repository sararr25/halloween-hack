-- S9 · the window across, drawn from the real photo of the terrace (round 9; the IMG_0413
-- view, rive/photo/plate_*.jpg). Scene units are the photo's own pixels (1536 x 1024).
-- 1. The photo as an image mesh: each vertex is pushed by the player's head according to how
--    near that part of the street is (the facade far, the garden walls, cars and the wet
--    road nearer), so the street shifts in perspective like a view through a real window.
--    The lit window (4A) is the anchor, so the figure layer in Reveal.tsx stays glued to it.
-- 2. window_across.wgsl layer 0, "screen": the light in 4A, its spill, its reflection on the
--    wet road, the lamp's bloom.
-- 3. The figure in 4A, drawn here as vector paths (owner, round 10): a black silhouette
--    clipped to the glass, standing to below the sill, feathered while the camera is far
--    and sharper the closer it pushes in. Its head copies the player's head; its arms are
--    two bones each, and the hand goes where the player's hand is (armX, armY: the palm
--    measured from the nose in face widths, mirrored), the elbow worked out from it. Then
--    the window bars and the sheer curtain over it.
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
    body: Path,
    hair: Path,
    strands: Path,
    arm: Path,
    hand: Path,
    fingers: Path,
    clip: Path,
    bars: Path,
    curtain: Path,
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
-- the figure, in photo px from the centre of its head: a person standing a step back from
-- the window, seen to below the sill. HEAD_W is one face width, the unit of armX, armY.
local HEAD = Vector.xy(912, 333)
local HEAD_W = 15
local SHOULDER = Vector.xy(15, 23)
local UPPER = 19
local FORE = 17
-- where a hand hangs at rest, in face widths from the nose (mirrored for the left arm)
local REST = Vector.xy(1.12, 4.2)
local INK = Color.rgb(7, 8, 11)

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

local function ellipse(p: Path, c: Vector, rx: number, ry: number, m: Mat2D)
    local k = 0.5523
    local function pt(x: number, y: number): Vector
        return m * Vector.xy(c.x + x, c.y + y)
    end
    p:moveTo(pt(rx, 0))
    p:cubicTo(pt(rx, ry * k), pt(rx * k, ry), pt(0, ry))
    p:cubicTo(pt(-rx * k, ry), pt(-rx, ry * k), pt(-rx, 0))
    p:cubicTo(pt(-rx, -ry * k), pt(-rx * k, -ry), pt(0, -ry))
    p:cubicTo(pt(rx * k, -ry), pt(rx, -ry * k), pt(rx, 0))
    p:close()
end

local function box(p: Path, x0: number, y0: number, x1: number, y1: number)
    p:moveTo(Vector.xy(x0, y0))
    p:lineTo(Vector.xy(x1, y0))
    p:lineTo(Vector.xy(x1, y1))
    p:lineTo(Vector.xy(x0, y1))
    p:close()
end

-- two bones from the shoulder to a hand at `want`; the elbow bends outward, away from the
-- body (side = -1 left, 1 right). Returns the elbow and where the wrist ends up.
local function reach(sh: Vector, want: Vector, side: number): (Vector, Vector)
    local d = want - sh
    local len = math.clamp(Vector.length(d), 4, UPPER + FORE - 0.01)
    local dir = Vector.normalized(d)
    local wrist = sh + dir * len
    local cosA = math.clamp((UPPER * UPPER + len * len - FORE * FORE) / (2 * UPPER * len), -1, 1)
    local a = math.acos(cosA)
    local base = math.atan2(dir.y, dir.x)
    local e1 = sh + Vector.xy(math.cos(base + a), math.sin(base + a)) * UPPER
    local e2 = sh + Vector.xy(math.cos(base - a), math.sin(base - a)) * UPPER
    local elbow = if e1.x * side > e2.x * side then e1 else e2
    return elbow, wrist
end

-- one arm: the sleeve as a thick stroke through the elbow, then an open hand at the wrist,
-- fingers along the forearm, the thumb towards the body
local function armTo(self: Across, sh: Vector, want: Vector, side: number)
    local elbow, wrist = reach(sh, want, side)
    self.arm:moveTo(sh)
    self.arm:lineTo(elbow)
    self.arm:lineTo(wrist)
    local along = Vector.normalized(wrist - elbow)
    local across = Vector.xy(-along.y, along.x)
    local palm = wrist + along * 2.6
    local turn = Mat2D.withTranslation(palm.x, palm.y) * Mat2D.withRotation(math.atan2(along.y, along.x) - math.pi / 2)
    ellipse(self.hand, Vector.xy(0, 0), 2.5, 3.2, turn)
    for i = 0, 3 do
        local off = (i - 1.5) * 1.35
        local spread = (i - 1.5) * 0.09
        local root = palm + along * 2.4 + across * off
        local tip = root + (along + across * spread) * (4.6 - math.abs(i - 1.4) * 0.7)
        self.fingers:moveTo(root)
        self.fingers:lineTo(tip)
    end
    local inward = if (across.x * side) < 0 then across else across * -1
    local root = palm + inward * 1.8 + along * 0.4
    self.fingers:moveTo(root)
    self.fingers:lineTo(root + (inward * 0.8 + along * 0.6) * 4)
end

local function figure(self: Across, renderer: Renderer, toScreen: Mat2D, alpha: number, feather: number)
    local hx = v(self, "headX")
    local hy = v(self, "headY")
    -- the body leans a little into the turn and breathes, barely; the head goes where the
    -- player's goes
    local breathe = math.sin(self.time * 1.6) * 0.35
    local bodyAt = Mat2D.withTranslation(HEAD.x + hx * 1.5, HEAD.y + breathe * 0.3)
    local headAt = bodyAt
        * Mat2D.withTranslation(hx * 3.5, 8 + hy * 2.2)
        * Mat2D.withRotation(hx * 0.16)
        * Mat2D.withTranslation(0, -8)

    for _, p in { self.body, self.hair, self.strands, self.arm, self.hand, self.fingers, self.clip, self.bars, self.curtain } do
        p:reset()
    end

    -- the torso, from the neck to well below the sill. Fills only show when wound
    -- clockwise on screen, so these symmetric outlines are written left to right and
    -- flipped (x -> -x) as they are placed.
    local function b(x: number, y: number): Vector
        return bodyAt * Vector.xy(-x, y + (if y > 14 then breathe else 0))
    end
    self.body:moveTo(b(-3.3, 7))
    self.body:lineTo(b(-3.6, 13.5))
    self.body:cubicTo(b(-6.5, 16.5), b(-13, 17.5), b(-16.5, 21))
    self.body:cubicTo(b(-18.2, 24), b(-16.8, 32), b(-15.8, 42))
    self.body:cubicTo(b(-14.6, 54), b(-13.2, 62), b(-13.8, 72))
    self.body:cubicTo(b(-14.4, 84), b(-16, 96), b(-16, 130))
    self.body:lineTo(b(16, 130))
    self.body:cubicTo(b(16, 96), b(14.4, 84), b(13.8, 72))
    self.body:cubicTo(b(13.2, 62), b(14.6, 54), b(15.8, 42))
    self.body:cubicTo(b(16.8, 32), b(18.2, 24), b(16.5, 21))
    self.body:cubicTo(b(13, 17.5), b(6.5, 16.5), b(3.6, 13.5))
    self.body:lineTo(b(3.3, 7))
    self.body:close()
    -- the head, a little narrower at the jaw
    ellipse(self.body, Vector.xy(0, 0), 7, 9.4, headAt)
    -- hair: past the shoulders, parted, a few loose strands
    local function h(x: number, y: number): Vector
        return headAt * Vector.xy(-x, y)
    end
    self.hair:moveTo(h(0, -10.6))
    self.hair:cubicTo(h(-7.5, -11.2), h(-10.4, -5), h(-10, 3))
    self.hair:cubicTo(h(-9.8, 10), h(-11.2, 15), h(-9.6, 21))
    self.hair:lineTo(h(-7.2, 17))
    self.hair:cubicTo(h(-7.4, 11), h(-7.6, 5), h(-6.4, -1))
    self.hair:cubicTo(h(-5, -6), h(-2, -7.5), h(0.5, -8.5))
    self.hair:cubicTo(h(3, -7.5), h(5.6, -6), h(6.6, -1))
    self.hair:cubicTo(h(7.6, 5), h(7.4, 11), h(7.4, 17))
    self.hair:lineTo(h(9.8, 20.5))
    self.hair:cubicTo(h(11.2, 15), h(9.8, 10), h(10, 3))
    self.hair:cubicTo(h(10.4, -5), h(7.5, -11.2), h(0, -10.6))
    self.hair:close()
    for i, x in { -10.2, -9, 9.4, 10.6, -4, 4.4 } do
        local fall = if math.abs(x) < 6 then 6 else 19 + (i % 2) * 3
        local sway = math.sin(self.time * 0.9 + i) * 0.4
        self.strands:moveTo(h(x * 0.92, if math.abs(x) < 6 then -8 else 2))
        self.strands:quadTo(h(x * 1.08 + sway, fall * 0.6), h(x * 1.02 + sway * 2, fall))
    end

    -- the arms: shoulder to the hand, wherever the player's is
    local nose = headAt * Vector.xy(0, 1.5)
    local want = Vector.xy(v(self, "armX"), v(self, "armY"))
    for _, side in { -1, 1 } do
        local sh = bodyAt * Vector.xy(SHOULDER.x * side, SHOULDER.y + breathe)
        -- the hand on the player's side follows them; the other hangs at rest
        local mine = (want.x >= 0) == (side > 0)
        local target = if mine then want else Vector.xy(REST.x * side, REST.y)
        local hand = nose + Vector.xy(target.x, target.y) * HEAD_W
        armTo(self, sh, hand, side)
    end

    -- clipped to the glass; seen through it, so never pure black and never quite sharp
    box(self.clip, GLASS.x0, GLASS.y0, GLASS.x1, GLASS.y1)
    renderer:save()
    renderer:transform(toScreen)
    renderer:clipPath(self.clip)
    local ink = Color.opacity(INK, alpha) :: Color
    local fill = Paint.with({ color = ink, style = "fill", feather = feather })
    renderer:drawPath(self.body, fill)
    renderer:drawPath(self.hair, fill)
    renderer:drawPath(self.hand, fill)
    renderer:drawPath(self.arm, Paint.with({ color = ink, style = "stroke", thickness = 7.2, cap = "round", join = "round", feather = feather }))
    renderer:drawPath(self.fingers, Paint.with({ color = ink, style = "stroke", thickness = 1.25, cap = "round", feather = feather }))
    renderer:drawPath(self.strands, Paint.with({ color = Color.opacity(INK, alpha * 0.8) :: Color, style = "stroke", thickness = 0.45, cap = "round", feather = feather }))

    -- in front of her: the sheer curtain on the left, catching the light, and the bars
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
        figure(self, renderer, toScreen, alpha, 9 * (1 - near) * (1 - near) + 0.35)
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
        body = Path.new(),
        hair = Path.new(),
        strands = Path.new(),
        arm = Path.new(),
        hand = Path.new(),
        fingers = Path.new(),
        clip = Path.new(),
        bars = Path.new(),
        curtain = Path.new(),
        init = init,
        resize = resize,
        advance = advance,
        draw = draw,
    }
end
