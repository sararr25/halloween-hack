-- Runs face_cloud.wgsl over the artboard. The host writes scan/points (the face mesh, encoded
-- as text: 6 printable chars per point, x y z, 2 chars each in base 90 from '!'),
-- scan/sweep, mode, reveal, spin, yaw, pitch. Points are decoded only when the text changes.
type Scanner = {
    scan: Input<Data.Scan>?,
    canvas: GPUCanvas?,
    pipeline: GPUPipeline?,
    ubo: GPUBuffer?,
    group: GPUBindGroup?,
    data: buffer,
    sampler: ImageSampler,
    time: number,
    lastPoints: string,
    count: number,
}

local HEADER = 48
local MAXP = 480
local SIZE = HEADER + MAXP * 16

local function decode(self: Scanner, text: string)
    local n = math.min(MAXP, math.floor(#text / 6))
    local d = self.data
    for i = 0, n - 1 do
        local at = i * 6
        for k = 0, 2 do
            local a, b = string.byte(text, at + k * 2 + 1, at + k * 2 + 2)
            local v = ((a - 33) * 90 + (b - 33)) / 8099 * 2.5 - 1.25
            buffer.writef32(d, HEADER + i * 16 + k * 4, v)
        end
    end
    self.count = n
    self.lastPoints = text
end

function init(self: Scanner, context: Context): boolean
    local shader = context:shader("face_cloud")
    self.canvas = context:gpuCanvas()
    if shader == nil or self.canvas == nil then
        return true
    end
    local canvas = self.canvas :: GPUCanvas
    local pipeline = GPUPipeline.new({
        vertex = shader,
        fragment = shader,
        vertexLayout = {},
        colorTargets = { {
            format = canvas.format,
            blend = { srcColor = "one", dstColor = "one", srcAlpha = "one", dstAlpha = "one" },
        } },
    })
    local ubo = GPUBuffer.new({ size = SIZE, usage = "uniform" })
    self.pipeline = pipeline
    self.ubo = ubo
    self.group = GPUBindGroup.new({
        layout = pipeline:getBindGroupLayout(0),
        ubos = { { slot = 0, buffer = ubo } },
    })
    return true
end

function resize(self: Scanner, size: Vector)
    local canvas = self.canvas
    if canvas and size.x > 0 and size.y > 0 then
        canvas:resize(math.ceil(size.x), math.ceil(size.y))
    end
end

function advance(self: Scanner, seconds: number): boolean
    self.time += seconds
    return true
end

function draw(self: Scanner, renderer: Renderer)
    local canvas = self.canvas
    local pipeline = self.pipeline
    local ubo = self.ubo
    local group = self.group
    if canvas == nil or pipeline == nil or ubo == nil or group == nil or canvas.width == 0 then
        return
    end
    local s = self.scan
    local sweep, mode, reveal, spin, yaw, pitch = 1.3, 1, 1, 1, 0, 0
    if s ~= nil then
        local text = s.points.value
        if text ~= self.lastPoints then
            decode(self, text)
        end
        sweep = s.sweep.value
        mode = s.mode.value
        reveal = s.reveal.value
        spin = s.spin.value
        yaw = s.yaw.value
        pitch = s.pitch.value
    end
    local d = self.data
    buffer.writef32(d, 0, self.time)
    buffer.writef32(d, 4, sweep)
    buffer.writef32(d, 8, mode)
    buffer.writef32(d, 12, self.count)
    buffer.writef32(d, 16, canvas.width)
    buffer.writef32(d, 20, canvas.height)
    buffer.writef32(d, 24, reveal)
    buffer.writef32(d, 28, spin)
    buffer.writef32(d, 32, yaw)
    buffer.writef32(d, 36, pitch)
    ubo:write(d)

    local pass = canvas:beginRenderPass({
        color = { { loadOp = "clear", storeOp = "store", clearColor = { 0, 0, 0, 0 } } },
    })
    pass:setPipeline(pipeline)
    pass:setBindGroup(0, group)
    pass:draw((MAXP + 1) * 6)
    pass:finish()

    renderer:drawImage(canvas.image, self.sampler, "srcOver", 1)
end

return function(context: Context): Layout<Scanner>
    return {
        scan = nil,
        canvas = nil,
        pipeline = nil,
        ubo = nil,
        group = nil,
        data = buffer.create(SIZE),
        sampler = ImageSampler("clamp", "clamp", "bilinear"),
        time = 0,
        lastPoints = "",
        count = 0,
        init = init,
        resize = resize,
        advance = advance,
        draw = draw,
    }
end
