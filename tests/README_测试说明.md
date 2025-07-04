# NuaaSwap 测试指南

本指南将帮助您在 Remix IDE 中测试 NuaaSwap 去中心化交易所合约。

## 📁 文件结构

```
tests/
├── TestNuaaSwap.sol          # 自动化单元测试合约
├── ManualTestNuaaSwap.sol    # 手动交互测试合约
├── SimpleTestNuaaSwap.sol    # 简化版测试合约
└── README_测试说明.md        # 本说明文档
```

## 🚀 快速开始

### 方法一：使用自动化测试合约

**推荐使用 SimpleTestNuaaSwap.sol** - 这是最简洁且无警告的版本

1. **打开 Remix IDE** (https://remix.ethereum.org/)

2. **导入文件**
   - 将所有合约文件导入到 Remix 工作区
   - 确保文件路径正确：`contracts/` 和 `tests/`

3. **编译合约**
   - 选择 Solidity 编译器版本 `0.8.20`
   - 编译 `SimpleTestNuaaSwap.sol`（推荐）

4. **运行测试**
   - 切换到 "Solidity Unit Testing" 插件
   - 选择测试文件
   - 点击 "Run" 按钮执行所有测试

### 方法二：使用手动测试合约 (ManualTestNuaaSwap.sol)

这种方法提供更直观的交互式测试体验。

## 🔧 手动测试步骤

### 步骤 1: 部署测试合约

1. 编译 `ManualTestNuaaSwap.sol`
2. 在 "Deploy & Run Transactions" 面板中部署合约
3. 确保使用足够的 Gas Limit (建议 8000000)

### 步骤 2: 初始化测试环境

```solidity
// 调用此函数来设置测试环境
setup()
```

**预期结果：**
- 部署 TokenA、TokenB 和 NuaaSwap 合约
- 测试合约获得初始代币供应
- 查看事件日志确认部署成功

### 步骤 3: 添加初始流动性

```solidity
// 添加 1000 Token A 和 2000 Token B 作为初始流动性
addInitialLiquidity()
```

**预期结果：**
- 合约储备增加
- 获得流动性 LP 代币份额
- 事件显示获得的份额数量

### 步骤 4: 测试代币交换

```solidity
// 将 100 个 Token A 交换为 Token B
testSwapAtoB(100000000000000000000)  // 100 * 10^18

// 将 200 个 Token B 交换为 Token A  
testSwapBtoA(200000000000000000000)  // 200 * 10^18
```

**预期结果：**
- 代币余额发生变化
- 获得相应数量的输出代币
- 储备池比例调整

### 步骤 5: 测试流动性移除

```solidity
// 移除一部分流动性份额
testRemoveLiquidity(1000000000000000000)  // 示例值
```

**预期结果：**
- 收回对应比例的两种代币
- 流动性份额减少

### 步骤 6: 测试管理员功能

```solidity
// 设置协议费用 (50 = 0.5%)
testSetProtocolFee(50)

// 设置费用接收地址
testSetFeeTo(0x742d35Cc6589C4532cE8C5eF6eA584c825b3BF1f)

// 暂停合约
testPause()

// 恢复合约
testUnpause()
```

## 📊 查询合约状态

### 获取合约信息

```solidity
getContractInfo()
```

**返回值说明：**
- `tokenAAddr`: Token A 合约地址
- `tokenBAddr`: Token B 合约地址  
- `swapAddr`: NuaaSwap 合约地址
- `reserve0`: Token A 储备量
- `reserve1`: Token B 储备量
- `totalShares`: 总流动性份额
- `userShares`: 当前用户份额
- `protocolFee`: 协议费用 (基点)
- `feeTo`: 费用接收地址

### 获取代币余额

```solidity
getUserBalances()
```

### 预估交换输出

```solidity
// 预估输入 100 Token A 能获得多少 Token B
estimateSwapOutput(tokenA_address, 100000000000000000000)
```

## ⚠️ 测试注意事项

### 1. Gas 费用设置
- 确保设置足够的 Gas Limit
- 推荐值：8,000,000

### 2. 数值输入格式
- 所有数值需要使用 wei 单位 (乘以 10^18)
- 例如：1 个代币 = `1000000000000000000`

### 3. 测试顺序
- 必须先调用 `setup()` 初始化
- 建议按照步骤顺序进行测试
- 在添加流动性后再进行交换测试

### 4. 错误处理
- 如果交易失败，检查：
  - Gas 限制是否足够
  - 授权是否完成
  - 输入参数是否正确
  - 合约是否被暂停

## 🧪 预期测试结果

### 成功的测试应该显示：

1. **流动性添加**
   - 储备增加到预期值
   - 获得正确的 LP 份额

2. **代币交换**
   - 根据 AMM 公式计算的正确输出
   - 考虑 0.3% 的交易费用

3. **流动性移除**
   - 按比例获得两种代币
   - LP 份额正确减少

4. **管理功能**
   - 暂停/恢复正常工作
   - 费用设置生效
   - 权限控制正确

## 🔍 故障排除

### 常见问题：

1. **"请先调用 setup() 函数"**
   - 确保先调用 `setup()` 初始化

2. **交易 revert**
   - 检查 Gas 限制
   - 确认代币余额充足
   - 验证输入参数格式

3. **权限错误**
   - 确保使用合约部署者账户执行管理员功能

4. **数值显示异常**
   - 记住所有数值都是 wei 单位
   - 实际值需要除以 10^18

5. **编译器警告**
   - **中文字符错误**：使用 `SimpleTestNuaaSwap.sol` 避免编码问题
   - **未使用变量警告**：已在 `TestNuaaSwap.sol` 中修复
   - **版本兼容性**：确保使用 Solidity 0.8.20

### 选择合适的测试文件：

- **SimpleTestNuaaSwap.sol** ✅ 推荐
  - 无编译警告
  - 简洁易懂
  - 核心功能完整

- **TestNuaaSwap.sol** ✅ 完整版
  - 已修复所有警告
  - 更详细的测试
  - 包含边界条件测试

- **ManualTestNuaaSwap.sol** ✅ 交互式
  - 手动测试
  - 实时查看结果
  - 事件日志详细

## 📈 高级测试场景

1. **大额交换测试**
   - 测试大额交换的滑点影响
   - 验证流动性池的稳定性

2. **边界条件测试**
   - 最小交换金额
   - 移除全部流动性
   - 设置最大协议费用

3. **多用户场景**
   - 使用不同账户进行测试
   - 验证多用户流动性提供

祝您测试顺利！如有问题，请检查 Remix 控制台的详细错误信息。 