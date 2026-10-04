-- Find My · View live: 17 Harrow St through binoculars. The real photo of the terrace
-- (plate_*.jpg, IMG_0413's view) is drawn by the 2D renderer, magnified around the look
-- point (shaders cannot sample image assets on the web): the soft plate always, the sharp
-- one over it as the binoculars come into focus, and a ghost of it while they move.
-- facade.wgsl layer 0 puts the light in the windows ("screen"); then the watcher (a cut-out
-- that turns round) or, once 4A is found, the figure with its hand raised, copying the
-- player's head; then layer 1: shapes behind curtains, rain, the lenses, grain.
-- The host writes facade/lookX, lookY (plate px), blur, glow, figX, figOn, turned, found
-- (seconds since found, -1 before), headX, headY.
type Facade = {
    facade: Input<Data.Facade>?,
    soft: Image?,
    sharp: Image?,
    back: Image?,
    front: Image?,
    hand: Image?,
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
    self.hand = context:image("figure_hand")
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
    -- the watcher turns round in half a second, and back the same way
    local want = if v(self, "turned", 0) >= 0.5 then 1 else 0
    local step = seconds * 2
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
        -- 4A: the figure with its hand raised, copying the player's head
        local hand = self.hand
        if hand ~= nil then
            local a = math.clamp((found - 0.9) / 0.5, 0, 1)
            local hx = v(self, "headX", 0)
            local hy = v(self, "headY", 0)
            -- smaller and a little left, so the raised hand stays inside the glass
            figureAt(self, renderer, hand, TARGET_X, 1, -9 + hx * 7, hy * 4, hx * 0.16, a * 0.95, FIG_SCALE * 0.78)
        end
    else
        local on = v(self, "figOn", 0)
        if on > 0.001 then
            local t = self.turn
            local image = if t < 0.5 then self.back else self.front
            if image ~= nil then
                local squash = math.max(0.04, math.abs(math.cos(t * math.pi)))
                figureAt(self, renderer, image, v(self, "figX", 0), squash, 0, 0, 0, on * 0.85, FIG_SCALE)
            end
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
        hand = nil,
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
