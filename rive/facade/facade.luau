-- Find My · View live: 17 Harrow St through binoculars. The real photo of the terrace
-- (plate_*.jpg, IMG_0413's view) is drawn by the 2D renderer, magnified around the look
-- point (shaders cannot sample image assets on the web): the soft plate always, the sharp
-- one over it as the binoculars come into focus, and a ghost of it while they move.
-- binoculars.wgsl layer 0 puts the light in the windows ("screen"); then, once revealed, the
-- watcher (a cut-out facing you; until then only a shape in the shader) or, once 4A is
-- found, someone standing in it: only a black, blurred shape at this distance, drawn here
-- as paths, swaying with the player's head (owner, round 10: no wave, no detail; the
-- figure is only seen clearly in S9); then layer 1: shapes behind curtains, rain, the
-- lenses, grain.
-- The host writes facade/lookX, lookY (plate px), blur, glow, figX, figOn, turned, found
-- (seconds since found, -1 before), headX, headY.
type Facade = {
    facade: Input<Data.Facade>?,
    soft: Image?,
    sharp: Image?,
    back: Image?,
    front: Image?,
    shape: Path,
    glass: Path,
    light: GPUCanvas?,
    top: GPUCanvas?,
    pipeline: GPUPipeline?,
    lightUbo: GPUBuffer?,
    topUbo: GPUBuffer?,
    lightGroup: GPUBindGroup?,
    topGroup: GPUBindGroup?,
    data: buffer,
    sampler: ImageSampler,
    time: number,
    turn: number,
    size: Vector,
}

-- artboard units per plate px: about 520 px of the street across the view
local K = 2.3
-- every window upstairs: glass from y 300 to 424, about 62 px wide
local WIN_TOP = 300
local WIN_BOTTOM = 424
local WIN_HALF = 31
local TARGET_X = 914
-- the cut-outs are 128 x 160; a person seen from the waist up behind the sash
local FIG_SCALE = 0.72

local function v(self: Facade, name: string, fallback: number): number
    local f = self.facade
    if f == nil then
        return fallback
    end
    if name == "lookX" then return f.lookX.value end
    if name == "lookY" then return f.lookY.value end
    if name == "blur" then return f.blur.value end
    if name == "glow" then return f.glow.value end
    if name == "figX" then return f.figX.value end
    if name == "figOn" then return f.figOn.value end
    if name == "turned" then return f.turned.value end
    if name == "found" then return f.found.value end
    if name == "headX" then return f.headX.value end
    return f.headY.value
end

function init(self: Facade, context: Context): boolean
    self.soft = context:image("plate_soft")
    self.sharp = context:image("plate_sharp")
    self.back = context:image("figure_back")
    self.front = context:image("figure_front")
    local shader = context:shader("binoculars")
    self.light = context:gpuCanvas()
    self.top = context:gpuCanvas()
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

function resize(self: Facade, size: Vector)
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

function advance(self: Facade, seconds: number): boolean
    self.time += seconds
    -- the watcher is revealed over a second (the shape fades, the person comes through)
    local want = if v(self, "turned", 0) >= 0.5 then 1 else 0
    local step = seconds * 1.1
    if self.turn < want then
        self.turn = math.min(want, self.turn + step)
    elseif self.turn > want then
        self.turn = math.max(want, self.turn - step)
    end
    return true
end

local function render(self: Facade, canvas: GPUCanvas, ubo: GPUBuffer, group: GPUBindGroup, layer: number, look: Vector)
    local d = self.data
    buffer.writef32(d, 0, self.time)
    buffer.writef32(d, 4, canvas.width)
    buffer.writef32(d, 8, canvas.height)
    buffer.writef32(d, 12, look.x)
    buffer.writef32(d, 16, look.y)
    buffer.writef32(d, 20, K * canvas.width / math.max(self.size.x, 1))
    buffer.writef32(d, 24, v(self, "blur", 0))
    buffer.writef32(d, 28, v(self, "glow", 0))
    buffer.writef32(d, 32, v(self, "figX", 0))
    buffer.writef32(d, 36, v(self, "figOn", 0))
    buffer.writef32(d, 40, v(self, "found", -1))
    buffer.writef32(d, 44, layer)
    buffer.writef32(d, 48, self.turn)
    ubo:write(d)
    local pass = canvas:beginRenderPass({
        color = { { loadOp = "clear", storeOp = "store", clearColor = { 0, 0, 0, 0 } } },
    })
    pass:setPipeline(self.pipeline :: GPUPipeline)
    pass:setBindGroup(0, group)
    pass:draw(3)
    pass:finish()
end

local function rect(x0: number, y0: number, x1: number, y1: number): Path
    local p = Path.new()
    p:moveTo(Vector.xy(x0, y0))
    p:lineTo(Vector.xy(x1, y0))
    p:lineTo(Vector.xy(x1, y1))
    p:lineTo(Vector.xy(x0, y1))
    p:close()
    return p
end

-- someone standing a step back from 4A's glass, seen to below the sill: head, hair to the
-- shoulders, the arms hanging; black and feathered, the way binoculars see a backlit shape.
-- Fills only show when wound clockwise on screen, so the outline is written left to right
-- and flipped (x -> -x) as it is placed.
local function shapeIn(self: Facade, renderer: Renderer, x: number, hx: number, hy: number, alpha: number)
    local p = self.shape
    p:reset()
    local breathe = math.sin(self.time * 1.6) * 0.35
    local body = Mat2D.withTranslation(x - 2 + hx * 1.5, 333 + breathe * 0.3)
    local head = body * Mat2D.withTranslation(hx * 3.5, 8 + hy * 2.2) * Mat2D.withRotation(hx * 0.16) * Mat2D.withTranslation(0, -8)
    local function b(px: number, py: number): Vector
        return body * Vector.xy(-px, py)
    end
    local function h(px: number, py: number): Vector
        return head * Vector.xy(-px, py)
    end
    p:moveTo(b(-3.3, 7))
    p:lineTo(b(-3.6, 13.5))
    p:cubicTo(b(-6.5, 16.5), b(-14, 17.5), b(-18, 21.5))
    p:cubicTo(b(-20.5, 26), b(-19.5, 40), b(-18.5, 60))
    p:lineTo(b(-18, 130))
    p:lineTo(b(18, 130))
    p:lineTo(b(18.5, 60))
    p:cubicTo(b(19.5, 40), b(20.5, 26), b(18, 21.5))
    p:cubicTo(b(14, 17.5), b(6.5, 16.5), b(3.6, 13.5))
    p:lineTo(b(3.3, 7))
    p:close()
    -- the head with the hair round it, falling past the shoulders
    p:moveTo(h(0, -10.8))
    p:cubicTo(h(-7.8, -11.4), h(-10.6, -5), h(-10.2, 3))
    p:cubicTo(h(-10, 10), h(-11.4, 15), h(-9.8, 21))
    p:lineTo(h(-5, 17))
    p:cubicTo(h(-3.5, 12), h(-3, 10), h(0, 9.6))
    p:cubicTo(h(3, 10), h(3.5, 12), h(5, 17))
    p:lineTo(h(9.8, 21))
    p:cubicTo(h(11.4, 15), h(10, 10), h(10.2, 3))
    p:cubicTo(h(10.6, -5), h(7.8, -11.4), h(0, -10.8))
    p:close()
    local g = self.glass
    g:reset()
    g:moveTo(Vector.xy(x - WIN_HALF, WIN_TOP))
    g:lineTo(Vector.xy(x + WIN_HALF, WIN_TOP))
    g:lineTo(Vector.xy(x + WIN_HALF, WIN_BOTTOM))
    g:lineTo(Vector.xy(x - WIN_HALF, WIN_BOTTOM))
    g:close()
    renderer:save()
    renderer:clipPath(g)
    renderer:drawPath(p, Paint.with({ color = Color.rgba(6, 7, 9, math.floor(255 * alpha)), style = "fill", feather = 5.5 }))
    renderer:restore()
end

-- a cut-out standing behind the window centred on x, clipped to its glass
local function figureAt(self: Facade, renderer: Renderer, image: Image, x: number, sx: number, dx: number, dy: number, tilt: number, opacity: number, scale: number)
    renderer:save()
    renderer:clipPath(rect(x - WIN_HALF, WIN_TOP, x + WIN_HALF, WIN_BOTTOM))
    renderer:transform(
        Mat2D.withTranslation(x + dx, WIN_BOTTOM + 8 + dy)
            * Mat2D.withRotation(tilt)
            * Mat2D.withScale(sx * scale, scale)
            * Mat2D.withTranslation(-image.width / 2, -image.height)
    )
    renderer:drawImage(image, self.sampler, "srcOver", opacity * 0.55)
    renderer:restore()
    -- three more copies, nudged a pixel: a cheap blur, as through glass and a sheer curtain
    for i = 1, 3 do
        local a = (i / 3) * math.pi * 2
        renderer:save()
        renderer:clipPath(rect(x - WIN_HALF, WIN_TOP, x + WIN_HALF, WIN_BOTTOM))
        renderer:transform(
            Mat2D.withTranslation(x + dx + math.cos(a) * 1.4, WIN_BOTTOM + 8 + dy + math.sin(a) * 1.4)
                * Mat2D.withRotation(tilt)
                * Mat2D.withScale(sx * scale, scale)
                * Mat2D.withTranslation(-image.width / 2, -image.height)
        )
        renderer:drawImage(image, self.sampler, "srcOver", opacity * 0.22)
        renderer:restore()
    end
end

function draw(self: Facade, renderer: Renderer)
    local soft = self.soft
    local sharp = self.sharp
    if soft == nil or sharp == nil or self.size.x <= 0 then
        return
    end
    local look = Vector.xy(v(self, "lookX", 914), v(self, "lookY", 420))
    local blur = v(self, "blur", 0)
    -- held binoculars are never quite still
    local sx = math.sin(self.time * 1.7) * 0.9 + math.sin(self.time * 4.3) * 0.4
    local sy = math.cos(self.time * 1.3) * 0.7
    local plate = Mat2D.withTranslation(self.size.x / 2, self.size.y / 2) * Mat2D.withScale(K, K) * Mat2D.withTranslation(-look.x + sx, -look.y + sy)

    renderer:save()
    renderer:transform(plate * Mat2D.withScale(1536 / soft.width, 1024 / soft.height))
    renderer:drawImage(soft, self.sampler, "srcOver", 1)
    renderer:restore()
    renderer:save()
    renderer:transform(plate * Mat2D.withScale(1536 / sharp.width, 1024 / sharp.height))
    renderer:drawImage(sharp, self.sampler, "srcOver", math.max(0, 1 - blur * 1.4))
    renderer:restore()
    -- moving, the two optics disagree: a faint second image, pulled sideways
    if blur > 0.05 then
        renderer:save()
        renderer:transform(plate * Mat2D.withTranslation(blur * 9, -blur * 3) * Mat2D.withScale(1536 / soft.width, 1024 / soft.height))
        renderer:drawImage(soft, self.sampler, "srcOver", blur * 0.35)
        renderer:restore()
    end

    local light = self.light
    local top = self.top
    local ready = self.pipeline ~= nil and light ~= nil and top ~= nil and (light :: GPUCanvas).width > 0
    if ready then
        render(self, light :: GPUCanvas, self.lightUbo :: GPUBuffer, self.lightGroup :: GPUBindGroup, 0, look)
        renderer:drawImage((light :: GPUCanvas).image, self.sampler, "screen", 1)
    end

    renderer:save()
    renderer:transform(plate)
    local found = v(self, "found", -1)
    if found >= 0 then
        -- 4A: someone in the light, only a shape; it sways when the player moves
        local a = math.clamp((found - 0.9) / 0.8, 0, 1)
        shapeIn(self, renderer, TARGET_X, v(self, "headX", 0), v(self, "headY", 0), a * 0.92)
    else
        local on = v(self, "figOn", 0)
        local t = self.turn
        local image = self.front
        if on > 0.001 and t > 0.01 and image ~= nil then
            -- revealed: the person comes through the curtain, facing you, with a small jolt
            local jolt = if t < 0.35 then math.sin(t * 60) * 1.5 else 0
            figureAt(self, renderer, image, v(self, "figX", 0), 1, jolt, 0, 0, on * t * 0.85, FIG_SCALE)
        end
    end
    renderer:restore()

    if ready then
        render(self, top :: GPUCanvas, self.topUbo :: GPUBuffer, self.topGroup :: GPUBindGroup, 1, look)
        renderer:drawImage((top :: GPUCanvas).image, self.sampler, "srcOver", 1)
    end
end

return function(context: Context): Layout<Facade>
    return {
        facade = nil,
        soft = nil,
        sharp = nil,
        back = nil,
        front = nil,
        shape = Path.new(),
        glass = Path.new(),
        light = nil,
        top = nil,
        pipeline = nil,
        lightUbo = nil,
        topUbo = nil,
        lightGroup = nil,
        topGroup = nil,
        data = buffer.create(64),
        sampler = ImageSampler("clamp", "clamp", "bilinear"),
        time = 0,
        turn = 0,
        size = Vector.xy(0, 0),
        init = init,
        resize = resize,
        advance = advance,
        draw = draw,
    }
end
