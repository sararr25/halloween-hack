-- Runs overlay_fx.wgsl over the whole artboard. The host sets intensities (grain,
-- vignette, glitch strength, neon) and fires tears by changing `pulse`: the page
-- schedules them so the shader tear, the DOM glitch and the glitch sound land together.
type Fx = {
    fx: Input<Data.Effects>?,
    canvas: GPUCanvas?,
    pipeline: GPUPipeline?,
    ubo: GPUBuffer?,
    group: GPUBindGroup?,
    data: buffer,
    sampler: ImageSampler,
    size: Vector,
    time: number,
    burst: number,
    lastPulse: number,
    seed: number,
}

local function value(self: Fx, name: string, fallback: number): number
    local fx = self.fx
    if fx == nil then
        return fallback
    end
    if name == "grain" then return fx.grain.value end
    if name == "vignette" then return fx.vignette.value end
    if name == "glitch" then return fx.glitch.value end
    if name == "pulse" then return fx.pulse.value end
    if name == "headX" then return fx.headX.value end
    if name == "headY" then return fx.headY.value end
    if name == "beam" then return fx.beam.value end
    if name == "crt" then return fx.crt.value end
    return fx.neon.value
end

function init(self: Fx, context: Context): boolean
    local shader = context:shader("overlay_fx")
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

function resize(self: Fx, size: Vector)
    self.size = size
    local canvas = self.canvas
    if canvas and size.x > 0 and size.y > 0 then
        canvas:resize(math.ceil(size.x), math.ceil(size.y))
    end
end

function advance(self: Fx, seconds: number): boolean
    self.time += seconds
    self.burst = math.max(0, self.burst - seconds * 9)
    local pulse = value(self, "pulse", 0)
    if pulse ~= self.lastPulse then
        self.lastPulse = pulse
        self.burst = 1
        self.seed = math.random() * 100
    end
    return true
end

function draw(self: Fx, renderer: Renderer)
    local canvas = self.canvas
    local pipeline = self.pipeline
    local ubo = self.ubo
    local group = self.group
    if canvas == nil or pipeline == nil or ubo == nil or group == nil or canvas.width == 0 then
        return
    end
    local d = self.data
    buffer.writef32(d, 0, self.time)
    buffer.writef32(d, 4, value(self, "grain", 0.3))
    buffer.writef32(d, 8, value(self, "vignette", 0.4))
    buffer.writef32(d, 12, self.burst * math.max(0.35, value(self, "glitch", 0)))
    buffer.writef32(d, 16, value(self, "neon", 0))
    buffer.writef32(d, 20, canvas.width)
    buffer.writef32(d, 24, canvas.height)
    buffer.writef32(d, 28, self.seed)
    buffer.writef32(d, 32, value(self, "headX", 0))
    buffer.writef32(d, 36, value(self, "headY", 0))
    buffer.writef32(d, 40, value(self, "beam", 0))
    buffer.writef32(d, 44, value(self, "crt", 0))
    ubo:write(d)

    local pass = canvas:beginRenderPass({
        color = { { loadOp = "clear", storeOp = "store", clearColor = { 0, 0, 0, 0 } } },
    })
    pass:setPipeline(pipeline)
    pass:setBindGroup(0, group)
    pass:draw(3)
    pass:finish()

    renderer:drawImage(canvas.image, self.sampler, "srcOver", 1)
end

return function(context: Context): Layout<Fx>
    return {
        fx = nil,
        canvas = nil,
        pipeline = nil,
        ubo = nil,
        group = nil,
        data = buffer.create(48),
        sampler = ImageSampler("clamp", "clamp", "bilinear"),
        size = Vector.xy(0, 0),
        time = 0,
        burst = 0,
        lastPulse = 0,
        seed = 0,
        init = init,
        resize = resize,
        advance = advance,
        draw = draw,
    }
end
