# uniapp-weixin-ci
uniapp-weixin-ci unixpp自动编译微信小程序

## 功能

- [x] 小程序编译项目
- [x] git仓库提交检查
- [x] 版本号自增加 版本号确认
- [x] 依赖更新检查
- [x] ci 上传代码
- [x] sourceMap 保存
- [ ] 命令行参数控制
- [ ] 配置文件控制

## 参考项目
[uniapp-ci](https://github.com/thetime50/uniapp-ci)

## 使用方法

[使用 uniapp cli 初始化项目](https://uniapp.dcloud.io/quickstart-cli)

```cmd
npm install -D uniapp-weixin-ci
```

配置 /src/manifest.json 小程序appid  
参考文件 /src/manifest.json.back
```json5
{
	"mp-weixin": { /* 微信小程序特有相关 */
		"appid": "wx6666666666666666",
    }
}
```

在小程序后台 开发-> 开发管理 -> 开发设置  
在小程序代码上传模块中 获取密钥 并 配置ip白名单  
密钥路径 /keys/wx-private.key  
格式参考 /keys/wx-private.key.back

运行 <code>npm run wxci-publish</code> 发布小程序
```cmd
npm run wxci-publish
```
