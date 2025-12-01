import { onBFCacheRestore } from './lib/bfcache.js'
import { bindReporter } from './lib/bindReporter.js'
import { getActivationStart } from './lib/getActivationStart.js'
import { getNavigationEntry } from './lib/getNavigationEntry.js'
import { initMetric } from './lib/initMetric.js'
import { whenActivated } from './lib/whenActivated.js'
import { MetricRatingThresholds, ReportOpts, TTFBMetric } from './types.js'

/**
 * TTFB（首字节时间）指标的评级阈值（Core Web Vitals 标准）
 * 核心规则（参考：https://web.dev/articles/ttfb#what_is_a_good_ttfb_score）：
 * - ≤800ms（0.8秒）→ good（良好）
 * - 800ms < 值 ≤1800ms（1.8秒）→ needs-improvement（待改进）
 * - >1800ms（1.8秒）→ poor（较差）
 */
export const TTFBThresholds: MetricRatingThresholds = [800, 1800]

/**
 * 等待页面「完全就绪」后执行回调（适配预渲染、加载中、已完成三种状态）
 * 核心目的：确保 Navigation Timing API 数据完全就绪（所有属性已填充），避免数据不全
 * @param {() => void} callback - 页面就绪后执行的回调函数
 */
const whenReady = (callback: () => void) => {
    if (document.prerendering) {
        // 场景1：页面处于预渲染状态 → 等待页面激活后，递归调用whenReady（激活后重新判定状态）
        whenActivated(() => whenReady(callback))
    } else if (document.readyState !== 'complete') {
        // 场景2：页面未完全加载（readyState≠complete）→ 监听load事件，加载完成后执行
        // 捕获阶段触发（true）：优先级更高，避免被其他事件 handler 阻塞
        addEventListener('load', () => whenReady(callback), true)
    } else {
        // 场景3：页面已完全加载 → 延迟0ms执行（推入微任务队列，确保在loadEventEnd后执行）
        setTimeout(callback, 0)
    }
}

/**
 * 监听并上报TTFB（首字节时间）指标的核心函数
 * TTFB定义：从页面时间原点到浏览器接收服务器响应首字节的时间差，反映网络+服务器响应性能
 * 核心设计：
 * 1. 等待页面完全就绪后计算（确保Navigation Timing数据完整）；
 * 2. 兼容预渲染、BFCache恢复场景；
 * 3. 基于Navigation Timing API精准计算，符合Core Web Vitals标准。
 * @param {(metric: TTFBMetric) => void} onReport - 指标上报回调（接收最终的TTFB指标对象）
 * @param {ReportOpts} [opts] - 上报配置项（如是否上报所有变化）
 *
 * 补充说明：
 * TTFB包含的耗时阶段：DNS解析 → TCP连接建立 → TLS协商（HTTPS）→ 网络延迟 → 服务器处理时间
 * 该指标依赖Navigation Timing API的navigation条目，需等待页面加载完成后才能获取完整数据
 */
export const onTTFB = (onReport: (metric: TTFBMetric) => void, opts?: ReportOpts) => {
    // 兼容配置项：未传则设为空对象
    opts = opts || {}

    // 1. 初始化TTFB指标对象（name固定为'TTFB'，初始值-1）
    let metric = initMetric('TTFB')
    // 2. 初始化上报函数：绑定回调、指标、阈值、配置项
    let report = bindReporter(onReport, metric, TTFBThresholds, opts.reportAllChanges)

    // 3. 等待页面完全就绪后，计算并上报TTFB
    whenReady(() => {
        // 3.1 获取navigation类型性能条目（Navigation Timing API核心数据）
        const navigationEntry = getNavigationEntry()

        // 3.2 仅当获取到有效条目时，计算TTFB值
        if (navigationEntry) {
            // 计算TTFB值（Core Web Vitals 标准逻辑）：
            // navigationEntry.responseStart：浏览器接收响应首字节的时间戳
            // getActivationStart()：预渲染页面的激活时间
            // 逻辑：TTFB = 首字节时间 - 激活时间，最小值为0（避免预渲染场景下出现负值）
            metric.value = Math.max(navigationEntry.responseStart - getActivationStart(), 0)

            // 记录navigation条目（用于归因，如导航类型、重定向次数等）
            metric.entries = [navigationEntry]
            // 强制触发上报（TTFB仅需上报一次，无需等待其他条件）
            report(true)

            // 4. 监听BFCache（后退/前进缓存）恢复事件（兼容缓存恢复场景）
            onBFCacheRestore(() => {
                // 重新初始化TTFB指标（BFCache恢复时，无新的网络请求，TTFB设为0）
                metric = initMetric('TTFB', 0)
                // 重新初始化上报函数
                report = bindReporter(onReport, metric, TTFBThresholds, opts!.reportAllChanges)

                // 强制上报BFCache恢复后的TTFB值（0ms，无网络开销）
                report(true)
            })
        }
    })
}
