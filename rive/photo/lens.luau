-- IMG_0418 in layers. The photo is a real image (the IMG_0413 view with the figure lifted
-- out into its own cut-out): the soft plate and the soft figure over the whole frame, then
-- photo_lens.wgsl's marks (the lit window, grain), then the lens: the sharp plate and the
-- sharp figure drawn again, magnified around the lens centre and clipped to its circle,
-- then the marks again, magnified and sharp, with the rim.
-- The figure stands where the photo has it (figure 0) or 259 px to the left (figure 1);
-- the host swaps it only while the user looks away.
-- Shaders cannot sample image assets on the web (Image:view samples zeros), so the lens
-- is done by the 2D renderer: clip + transform. The host writes photo/lensX, lensY, lens
-- (strength), figure, silhouette.
type Lens = {
    photo: Input<Data.Photo>?,
    soft: Image?,
    sharp: Image?,
    figureSoft: Image?,
    figureSharp: Image?,
    frame: GPUCanvas?,
    loupe: GPUCanvas?,
    pipeline: GPUPipeline?,
    frameUbo: GPUBuffer?,
    loupeUbo: GPUBuffer?,
    frameGroup: GPUBindGroup?,
    loupeGroup: GPUBindGroup?,
    data: buffer,
    sampler: ImageSampler,
    time: number,
    size: Vector,
}

local ZOOM = 1.8
local BLUR = 3
local RADIUS = 136 -- scene units
local K = 0.5522847 -- circle as four cubics
-- the cut-out's corner in photo pixels, and how far it moves for figure = 1
local FIGURE_X = 880
local FIGURE_Y = 668
local FIGURE_SHIFT = -259

local function value(self: Lens, name: string, fallback: number): number
    local p = self.photo
    if p == nil then
        return fallback
    end
    if name == "lensX" then return p.lensX.value end
    if name == "lensY" then return p.lensY.value end
    if name == "lens" then return p.lens.value end
    if name == "figure" then return p.figure.value end
    return p.silhouette.value
end

function init(self: Lens, context: Context): boolean
    self.soft = context:image("plate_soft")
    self.sharp = context:image("plate_sharp")
    self.figureSoft = context:image("figure_soft")
    self.figureSharp = context:image("figure_sharp")
    local shader = context:shader("photo_lens")
    self.frame = context:gpuCanvas()
    self.loupe = context:gpuCanvas()
    if shader == nil or self.frame == nil or self.loupe == nil then
        return true
    end
    local frame = self.frame :: GPUCanvas
    local pipeline = GPUPipeline.new({
        vertex = shader,
        fragment = shader,
        vertexLayout = {},
        colorTargets = { { format = frame.format } },
    })
    self.pipeline = pipeline
    local frameUbo = GPUBuffer.new({ size = 48, usage = "uniform" })
    local loupeUbo = GPUBuffer.new({ size = 48, usage = "uniform" })
    self.frameUbo = frameUbo
    self.loupeUbo = loupeUbo
    self.frameGroup = GPUBindGroup.new({
        layout = pipeline:getBindGroupLayout(0),
        ubos = { { slot = 0, buffer = frameUbo } },
    })
    self.loupeGroup = GPUBindGroup.new({
        layout = pipeline:getBindGroupLayout(0),
        ubos = { { slot = 0, buffer = loupeUbo } },
    })
    return true
end

function resize(self: Lens, size: Vector)
    self.size = size
    if size.x <= 0 or size.y <= 0 then
        return
    end
    if self.frame then
        (self.frame :: GPUCanvas):resize(math.ceil(size.x), math.ceil(size.y))
    end
    if self.loupe then
        (self.loupe :: GPUCanvas):resize(math.ceil(size.x), math.ceil(size.y))
    end
end

function advance(self: Lens, seconds: number): boolean
    self.time += seconds
    return true
end

local function render(self: Lens, canvas: GPUCanvas, ubo: GPUBuffer, group: GPUBindGroup, layer: number)
    local d = self.data
    buffer.writef32(d, 0, self.time)
    buffer.writef32(d, 4, value(self, "lensX", 0.5))
    buffer.writef32(d, 8, value(self, "lensY", 0.5))
    buffer.writef32(d, 12, value(self, "lens", 0))
    buffer.writef32(d, 16, canvas.width)
    buffer.writef32(d, 20, canvas.height)
    buffer.writef32(d, 24, ZOOM)
    buffer.writef32(d, 28, BLUR)
    buffer.writef32(d, 32, value(self, "figure", 0))
    buffer.writef32(d, 36, value(self, "silhouette", 0.12))
    buffer.writef32(d, 40, layer)
    buffer.writef32(d, 44, RADIUS)
    ubo:write(d)
    local pass = canvas:beginRenderPass({
        color = { { loadOp = "clear", storeOp = "store", clearColor = { 0, 0, 0, 0 } } },
    })
    pass:setPipeline(self.pipeline :: GPUPipeline)
    pass:setBindGroup(0, group)
    pass:draw(3)
    pass:finish()
end

-- the photo, scaled from its own pixels to the artboard, with the figure where it stands
local function drawPlate(self: Lens, renderer: Renderer, image: Image, figure: Image?, opacity: number)
    renderer:save()
    renderer:transform(Mat2D.withScale(self.size.x / image.width, self.size.y / image.height))
    renderer:drawImage(image, self.sampler, "srcOver", opacity)
    if figure ~= nil then
        local x = FIGURE_X
        if value(self, "figure", 0) >= 0.5 then
            x += FIGURE_SHIFT
        end
        renderer:transform(Mat2D.withTranslation(x, FIGURE_Y))
        renderer:drawImage(figure, self.sampler, "srcOver", opacity)
    end
    renderer:restore()
end

function draw(self: Lens, renderer: Renderer)
    local soft = self.soft
    local sharp = self.sharp
    if soft == nil or sharp == nil or self.size.x <= 0 then
        return
    end
    drawPlate(self, renderer, soft, self.figureSoft, 1)

    local frame = self.frame
    local loupe = self.loupe
    local ready = self.pipeline ~= nil and frame ~= nil and loupe ~= nil and (frame :: GPUCanvas).width > 0
    if ready then
        render(self, frame :: GPUCanvas, self.frameUbo :: GPUBuffer, self.frameGroup :: GPUBindGroup, 0)
        renderer:drawImage((frame :: GPUCanvas).image, self.sampler, "srcOver", 1)
    end

    local strength = value(self, "lens", 0)
    if strength <= 0.001 then
        return
    end
    -- the lens: the sharp photo, magnified around the centre, inside the circle
    local sx = self.size.x / 1200
    local cx = value(self, "lensX", 0.5) * self.size.x
    local cy = value(self, "lensY", 0.5) * self.size.y
    local r = RADIUS * sx
    local k = r * K
    local circle = Path.new()
    circle:moveTo(Vector.xy(cx + r, cy))
    circle:cubicTo(Vector.xy(cx + r, cy + k), Vector.xy(cx + k, cy + r), Vector.xy(cx, cy + r))
    circle:cubicTo(Vector.xy(cx - k, cy + r), Vector.xy(cx - r, cy + k), Vector.xy(cx - r, cy))
    circle:cubicTo(Vector.xy(cx - r, cy - k), Vector.xy(cx - k, cy - r), Vector.xy(cx, cy - r))
    circle:cubicTo(Vector.xy(cx + k, cy - r), Vector.xy(cx + r, cy - k), Vector.xy(cx + r, cy))
    circle:close()
    local z = 1 + (ZOOM - 1) * strength
    renderer:save()
    renderer:clipPath(circle)
    renderer:transform(Mat2D.withTranslation(cx, cy) * Mat2D.withScale(z, z) * Mat2D.withTranslation(-cx, -cy))
    drawPlate(self, renderer, sharp, self.figureSharp, strength)
    renderer:restore()

    if ready then
        render(self, loupe :: GPUCanvas, self.loupeUbo :: GPUBuffer, self.loupeGroup :: GPUBindGroup, 1)
        renderer:drawImage((loupe :: GPUCanvas).image, self.sampler, "srcOver", 1)
    end
end

return function(context: Context): Layout<Lens>
    return {
        photo = nil,
        soft = nil,
        sharp = nil,
        figureSoft = nil,
        figureSharp = nil,
        frame = nil,
        loupe = nil,
        pipeline = nil,
        frameUbo = nil,
        loupeUbo = nil,
        frameGroup = nil,
        loupeGroup = nil,
        data = buffer.create(48),
        sampler = ImageSampler("clamp", "clamp", "bilinear"),
        time = 0,
        size = Vector.xy(0, 0),
        init = init,
        resize = resize,
        advance = advance,
        draw = draw,
    }
end
