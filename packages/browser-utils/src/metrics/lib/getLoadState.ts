import { LoadState } from '../types'
import { getNavigationEntry } from './getNavigationEntry'

/**
 * 根据指定时间戳，判定该时刻文档所处的加载状态（细分的LoadState类型）
 * 核心逻辑：结合document.readyState和PerformanceNavigationTiming的关键时间节点，精准划分加载阶段
 * @param {number} timestamp - 待判定的时间戳（毫秒级，通常为性能指标触发的时间）
 * @returns {LoadState} 文档加载状态：loading/dom-interactive/dom-content-loaded/complete
 */
export const getLoadState = (timestamp: number): LoadState => {
    // 1. 优先判断document.readyState：若仍处于loading状态，直接返回loading
    if (document.readyState === 'loading') {
        return 'loading'
    } else {
        // 2. 获取导航计时条目（PerformanceNavigationTiming），用于精准判定阶段
        const navigationEntry = getNavigationEntry()

        // 3. 若导航条目存在，按时间节点细分加载状态
        if (navigationEntry) {
            // 时间戳早于domInteractive（DOM解析完成时间）→ 仍处于loading阶段
            if (timestamp < navigationEntry.domInteractive) {
                return 'loading'
            }
            // 时间戳在domInteractive之后、DOMContentLoaded事件触发之前 → dom-interactive阶段
            else if (
                navigationEntry.domContentLoadedEventStart === 0 || // 兼容未触发DOMContentLoaded的场景
                navigationEntry.domContentLoadedEventStart < timestamp
            ) {
                return 'dom-interactive'
            }
            // 时间戳在DOMContentLoaded之后、domComplete（文档加载完成）之前 → dom-content-loaded阶段
            else if (
                navigationEntry.domComplete === 0 || // 兼容未完成加载的场景
                timestamp > navigationEntry.domComplete
            ) {
                return 'dom-content-loaded'
            }
        }
    }

    // 4. 兜底：所有判定条件不满足时，返回complete（文档及所有子资源加载完成）
    return 'complete'
}
