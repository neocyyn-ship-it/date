# 女装电商经营分析工作台

基于 `Electron + React + TypeScript + Vite + Ant Design + ECharts + DuckDB + SheetJS + Zustand + dayjs` 的本地桌面经营分析应用。

## 已实现能力

- Excel 多文件导入与导入记录
- 两类模板识别：退款分析表、新品商品经营表
- 周期解析：周区间、精确区间、近 30 天、整月
- DuckDB 本地持久化
- 同周期同商品逻辑替换，新周期自动追加
- 商品图映射基础能力
- 经营总览、渠道营销、退款诊断、商品分析、导入中心、导入记录页面
- 加权退款均值、ROI、环比、商品标签分类

## 本地启动

```powershell
.\pnpm.exe dev
```

## 构建

```powershell
.\pnpm.exe build
.\pnpm.exe build:win
```

## 样例验证

```powershell
.\pnpm.exe test:import -- samples-product.xls samples-refund.xlsx
```
