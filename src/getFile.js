/*
 * @Description: 这是获取文件页面（组件）
 * @Date: 2022-12-21 15:05:38
 * @Author: zouzheng
 * @LastEditors: zouzheng
 * @LastEditTime: 2023-01-07 00:06:19
 */
const { decompressFromEncodedURIComponent } = require("lz-string")
const localforage = require("localforage")
const config = require("./config")
const { version, fileDate } = require("../package.json")

/**
 * @description: 获取远程文件
 * @param {*} url/文件url
 * @param {*} file/文件地址
 * @param {*} list/地址链接列表
 * @return {*}
 */
const fetchFile = async ({ url, file, list }) => {
    let index = list.findIndex(item => item === url)
    index = index === -1 ? 0 : index
    try {
        const fileJson = await fetch(`${list[index]}/static/${file}.json`).then(res => res.json())
        const jsonStr = decompressFromEncodedURIComponent(fileJson.s)
        const result = JSON.parse(jsonStr)
        return result
    } catch (error) {
        // 最后一个路径失败则终止
        if (index === list.length - 1) {
            throw new Error("定位失败")
        }
        return fetchFile({ url: list[index + 1], file, list })
    }
}

class GetFile {
    constructor() {
        this.local = null;
        this.localConfig = {
            name: "pikazLocation",
            // 没有文件系统破坏性更新时则不更新大版本
            storeName: "v" + version.split(".")[0] + "." + version.split(".")[1]
        };
    }
    /**
     * @description: 获取文件
     * @param {*} dir/文件夹
     * @param {*} file/文件名
     * @return {*}
     */
    async get({ dir, file }) {
        if (!this.local) {
            const local = localforage.createInstance(this.localConfig);
            await local.ready()
            this.local = local
        }
        // 先从本地拿
        const name = `${dir}-${file}-${fileDate[dir]}`
        const localResult = await this.local.getItem(name)
        if (localResult) {
            return localResult
        }
        // 没有则从远程获取
        try {
            const result = await fetchFile({ file: `${dir}/${file}`, list: config.cdn })
            // 异步写入
            this.local.setItem(name, result)
            return result
        } catch (error) {
            throw new Error("定位失败")
        }
    }

    /**
     * @description: 获取缓存值
     * @param {*} key
     * @param {*} gainVal/如果没有缓存则调用该函数获取值
     * @param {*} expiration/有效期，默认永久
     * @return {*}
     */
    async getVal({ key, gainVal, expiration }) {
        if (!this.local) {
            const local = localforage.createInstance(this.localConfig);
            await local.ready()
            this.local = local
        }
        // 当前时间
        const now = new Date().getTime()
        // 过期时长
        const time = expiration || 0
        const name = `local-${key}`
        const localResult = await this.local.getItem(name)
        if (localResult) {
            // 未过期
            if (localResult.expiration > now) {
                return localResult.val
            }
        }
        const result = await gainVal()
        await this.local.setItem(name, { val: result, expiration: now + time })
        return result
    }

    /**
     * @description: 清空缓存
     * @return {*}
     */
    async clear() {
        await this.local.clear()
    }
}

module.exports = new GetFile()