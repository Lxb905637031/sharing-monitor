/**
 * 性能条目类型映射表：关联「性能条目类型字符串」与「对应的性能条目数组类型」
 * 核心作用：通过键值对强绑定类型，避免PerformanceObserver获取条目时的类型断言错误
 */
interface PerformanceEntryMap {
    // 通用事件计时条目（如INP相关）
    event: PerformanceEventTiming[]
    // 首次输入事件条目（FID相关）
    'first-input': PerformanceEventTiming[]
    // 布局偏移条目（CLS相关）
    'layout-shift': LayoutShift[]
    // 最大内容绘制条目（LCP相关）
    'largest-contentful-paint': LargestContentfulPaint[]
    // 长动画帧条目（INP卡顿归因相关）
    'long-animation-frame': PerformanceLongAnimationFrameTiming[]
    // 绘制条目（FCP相关）
    paint: PerformancePaintTiming[]
    // 导航计时条目（TTFB/LCP归因相关）
    navigation: PerformanceNavigationTiming[]
    // 资源加载条目（LCP资源加载归因相关）
    resource: PerformanceResourceTiming[]
}

/**
 * 通用性能条目监听函数（封装PerformanceObserver，简化性能指标监控）
 * 核心优势：通过泛型和类型映射表，实现类型安全的性能条目监听，自动适配不同类型的性能数据
 * @template K - 泛型约束：限定为PerformanceEntryMap的键（即支持的性能条目类型）
 * @param {K} type - 要监听的性能条目类型（如'layout-shift'/'largest-contentful-paint'）
 * @param {(entries: PerformanceEntryMap[K]) => void} callback - 条目回调函数，参数为对应类型的条目数组
 * @param {PerformanceObserverInit} [opts] - PerformanceObserver配置项（可选，会覆盖默认配置）
 * @returns {PerformanceObserver | undefined} 性能观察器实例（用于后续取消监听），失败时返回undefined
 */
export const observe = <K extends keyof PerformanceEntryMap>(
    type: K,
    callback: (entries: PerformanceEntryMap[K]) => void,
    opts?: PerformanceObserverInit
): PerformanceObserver | undefined => {
    try {
        // 1. 兼容性校验：当前浏览器支持该类型的性能条目监听
        if (PerformanceObserver.supportedEntryTypes.includes(type)) {
            // 2. 创建性能观察器实例
            const po = new PerformanceObserver(list => {
                // 3. 异步执行回调（Promise.resolve()推入微任务队列）
                // 目的：避免同步回调阻塞主线程，且保证条目数据已完全就绪
                Promise.resolve().then(() => {
                    // 4. 获取性能条目并断言为对应类型（通过PerformanceEntryMap保证类型安全）
                    callback(list.getEntries() as PerformanceEntryMap[K])
                })
            })

            // 5. 配置并启动观察器
            po.observe(
                // 合并默认配置与用户配置：
                // - 默认：监听指定类型 + 启用buffered（获取历史条目）
                // - 用户配置优先级更高，可覆盖默认值
                Object.assign(
                    {
                        type, // 监听的性能条目类型
                        buffered: true, // 启用buffered：获取调用observe前已产生的历史条目（关键！避免遗漏早期条目）
                    },
                    opts || {}
                ) as PerformanceObserverInit
            )

            // 6. 返回观察器实例，供外部取消监听（如po.disconnect()）
            return po
        }
    } catch {
        // 静默捕获所有异常（如浏览器不支持PerformanceObserver、参数错误等）
        // 避免监控代码崩溃业务逻辑
    }

    // 7. 兼容性不支持/执行出错时，返回undefined
    return
}
