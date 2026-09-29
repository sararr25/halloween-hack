-- Runs fx.wgsl over the whole artboard. Bursts of glitch are scheduled here so the
-- host only sets intensities: grain, vignette, glitch (burst rate/strength), neon.
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
    nextBurst: number,
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
    local ubo = GPUBuffer.new({ size = 32, usage = "uniform" })
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
    -- glitch 0..1 maps to the stage cadence in HANDOVER: every ~12 s at low, ~1.5 s at full
    local glitch = value(self, "glitch", 0)
    self.burst = math.max(0, self.burst - seconds * 9)
    if glitch > 0.01 and self.time >= self.nextBurst then
        self.burst = 1
        self.seed = math.random() * 100
        local gap = 12 - 10.5 * glitch
        self.nextBurst = self.time + gap * (0.7 + math.random() * 0.6)
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
        data = buffer.create(32),
        sampler = ImageSampler("clamp", "clamp", "bilinear"),
        size = Vector.xy(0, 0),
        time = 0,
        burst = 0,
        nextBurst = 1,
        seed = 0,
        init = init,
        resize = resize,
        advance = advance,
        draw = draw,
    }
end
