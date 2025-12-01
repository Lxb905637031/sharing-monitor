import { MetricType } from '../types'
import { getBFCacheRestoreTime } from './bfcache'
import { generateUniqueID } from './generateUniqueID'
import { getActivationStart } from './getActivationStart'
import { getNavigationEntry } from './getNavigationEntry'

/**
 * 初始化性能指标对象
 * 核心作用：统一初始化指标的基础字段，尤其是精准判定导航类型，为性能监控提供标准化的初始数据
 * @template MetricName - 泛型约束：限定为MetricType中name字段的取值（如'CLS'/'FCP'/'LCP'/'INP'/'TTFB'等）
 * @param {MetricName} name - 指标名称（如'CLS'），泛型限定保证类型安全
 * @param {number} [value] - 指标初始值（可选，默认-1表示未初始化）
 * @returns {Extract<MetricType, { name: MetricName }>} 初始化后的指定类型指标对象
 */
export const initMetric = <MetricName extends MetricType['name']>(name: MetricName, value?: number) => {
    // 1. 获取页面导航性能条目（用于判定常规导航类型）
    const navEntry = getNavigationEntry()
    // 2. 初始化导航类型，默认值为普通导航（navigate）
    let navigationType: MetricType['navigationType'] = 'navigate'

    // 3. 按优先级判定真实的导航类型（优先级从高到低）
    if (getBFCacheRestoreTime() > 0) {
        // 优先级1：页面从后退/前进缓存（BFCache）恢复 → back-forward-cache
        navigationType = 'back-forward-cache'
    } else if (navEntry) {
        // 优先级2：导航条目存在时，进一步细分
        if (
            document.prerendering || // 页面处于预渲染状态
            getActivationStart() > 0 // 预渲染页面激活时间>0（预渲染完成后激活）
        ) {
            navigationType = 'prerender' // 预渲染导航
        } else if (document.wasDiscarded) {
            // 页面被浏览器丢弃后由用户恢复 → restore
            navigationType = 'restore'
        } else if (navEntry.type) {
            // 基于导航条目的原生type字段，替换下划线为连字符（如back_forward → back-forward）
            // 类型断言保证与MetricType的navigationType类型匹配
            navigationType = navEntry.type.replace(/_/g, '-') as MetricType['navigationType']
        }
    }

    // 4. 初始化指标关联的性能条目数组（泛型提取指定指标的entries类型，保证类型精准）
    const entries: Extract<MetricType, { name: MetricName }>['entries'] = []

    // 5. 返回标准化的初始指标对象
    return {
        name, // 指标名称（如'CLS'）
        // 初始值：未传则设为-1（表示指标未计算完成），传值则使用指定值
        value: typeof value === 'undefined' ? -1 : value,
        // 初始评级设为good（后续上报时会重新计算）；`as const` 防止类型拓宽为string，保证与MetricType['rating']匹配
        rating: 'good' as const,
        delta: 0, // 初始差值为0（首次上报时会计算与历史值的差值）
        entries, // 关联的性能条目数组（初始为空，后续填充）
        id: generateUniqueID(), // 生成指标实例唯一ID（用于去重/分组）
        navigationType, // 最终判定的导航类型
    }
}
