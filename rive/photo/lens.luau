-- Runs photo_lens.wgsl over the whole artboard: the shader draws the photo itself and the
-- lens over it. The host writes photo/lensX, lensY, lens (strength), figure, silhouette.
type Lens = {
    photo: Input<Data.Photo>?,
    canvas: GPUCanvas?,
    pipeline: GPUPipeline?,
    ubo: GPUBuffer?,
    group: GPUBindGroup?,
    data: buffer,
    sampler: ImageSampler,
    time: number,
}

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
    local shader = context:shader("photo_lens")
    self.canvas = context:gpuCanvas()
    if shader == nil or self.canvas == nil then
        return true
    end
    local canvas = self.canvas :: GPUCanvas
    local pipeline = GPUPipeline.new({
        vertex = shader,
        fragment = shader,
        vertexLayout = {},
        colorTargets = { { format = canvas.format } },
    })
    local ubo = GPUBuffer.new({ size = 48, usage = "uniform" })
    self.pipeline = pipeline
    self.ubo = ubo
    self.group = GPUBindGroup.new({
        layout = pipeline:getBindGroupLayout(0),
        ubos = { { slot = 0, buffer = ubo } },
    })
    return true
end

-- 1 canvas pixel per artboard unit, like the overlay: drawImage places it 1:1
function resize(self: Lens, size: Vector)
    local canvas = self.canvas
    if canvas and size.x > 0 and size.y > 0 then
        canvas:resize(math.ceil(size.x), math.ceil(size.y))
    end
end

function advance(self: Lens, seconds: number): boolean
    self.time += seconds
    return true
end

function draw(self: Lens, renderer: Renderer)
    local canvas = self.canvas
    local pipeline = self.pipeline
    local ubo = self.ubo
    local group = self.group
    if canvas == nil or pipeline == nil or ubo == nil or group == nil or canvas.width == 0 then
        return
    end
    local d = self.data
    buffer.writef32(d, 0, self.time)
    buffer.writef32(d, 4, value(self, "lensX", 0.5))
    buffer.writef32(d, 8, value(self, "lensY", 0.5))
    buffer.writef32(d, 12, value(self, "lens", 0))
    buffer.writef32(d, 16, canvas.width)
    buffer.writef32(d, 20, canvas.height)
    buffer.writef32(d, 24, 2.4)
    buffer.writef32(d, 28, 4.5)
    buffer.writef32(d, 32, value(self, "figure", 0))
    buffer.writef32(d, 36, value(self, "silhouette", 0.12))
    ubo:write(d)

    local pass = canvas:beginRenderPass({
        color = { { loadOp = "clear", storeOp = "store", clearColor = { 0, 0, 0, 1 } } },
    })
    pass:setPipeline(pipeline)
    pass:setBindGroup(0, group)
    pass:draw(3)
    pass:finish()

    renderer:drawImage(canvas.image, self.sampler, "srcOver", 1)
end

return function(context: Context): Layout<Lens>
    return {
        photo = nil,
        canvas = nil,
        pipeline = nil,
        ubo = nil,
        group = nil,
        data = buffer.create(48),
        sampler = ImageSampler("clamp", "clamp", "bilinear"),
        time = 0,
        init = init,
        resize = resize,
        advance = advance,
        draw = draw,
    }
end
