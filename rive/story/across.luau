-- Runs window_across.wgsl over the artboard (S9). The host writes across/headX, headY
-- (the user's head, no lag), zoom, light, corruption, figure, neon.
type Across = {
    across: Input<Data.Across>?,
    canvas: GPUCanvas?,
    pipeline: GPUPipeline?,
    ubo: GPUBuffer?,
    group: GPUBindGroup?,
    data: buffer,
    sampler: ImageSampler,
    time: number,
}

function init(self: Across, context: Context): boolean
    local shader = context:shader("window_across")
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

function resize(self: Across, size: Vector)
    local canvas = self.canvas
    if canvas and size.x > 0 and size.y > 0 then
        canvas:resize(math.ceil(size.x), math.ceil(size.y))
    end
end

function advance(self: Across, seconds: number): boolean
    self.time += seconds
    return true
end

function draw(self: Across, renderer: Renderer)
    local canvas = self.canvas
    local pipeline = self.pipeline
    local ubo = self.ubo
    local group = self.group
    if canvas == nil or pipeline == nil or ubo == nil or group == nil or canvas.width == 0 then
        return
    end
    local a = self.across
    local d = self.data
    buffer.writef32(d, 0, self.time)
    buffer.writef32(d, 4, canvas.width)
    buffer.writef32(d, 8, canvas.height)
    if a ~= nil then
        buffer.writef32(d, 12, a.headX.value)
        buffer.writef32(d, 16, a.headY.value)
        buffer.writef32(d, 20, a.zoom.value)
        buffer.writef32(d, 24, a.light.value)
        buffer.writef32(d, 28, a.corruption.value)
        buffer.writef32(d, 32, a.figure.value)
        buffer.writef32(d, 36, a.neon.value)
    end
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

return function(context: Context): Layout<Across>
    return {
        across = nil,
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
