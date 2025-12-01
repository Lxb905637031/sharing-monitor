/**
 * 生成带前缀的唯一ID（非标准UUID，轻量级自定义实现）
 * 核心逻辑：时间戳 + 随机数，保证极高概率的唯一性
 * @returns {string} 格式为 `v4-${时间戳}-${12位随机数}` 的唯一ID字符串
 */
export const generateUniqueID = () => {
    return `v4-${Date.now()}-${Math.floor(Math.random() * (9e12 - 1)) + 1e12}`
}
