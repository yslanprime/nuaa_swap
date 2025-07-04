# NuaaSwap - 去中心化交易所

这是南京航空航天大学区块链课程的期末考试项目，实现了一个基于以太坊的去中心化交易所（DEX）。

## 📋 项目概述

NuaaSwap 是一个基于自动做市商（AMM）模型的去中心化交易所，采用恒定乘积公式（x * y = k）实现代币交换。该项目包含完整的智能合约实现、测试套件和部署脚本。

### 🎯 核心功能

- **流动性管理**：添加和移除流动性池
- **代币交换**：基于 AMM 算法的自动代币交换
- **费用机制**：0.3% 交易费用 + 可配置协议费用
- **安全保护**：重入攻击防护、滑点保护、权限管理
- **管理功能**：合约暂停/恢复、费用配置

## 🏗️ 项目架构

```
nuaa_swap/
├── contracts/
│   ├── nuaa_swap.sol      # 核心交换合约
│   ├── corn_a.sol         # 测试代币 A
│   └── corn_b.sol         # 测试代币 B
├── tests/
│   ├── TestNuaaSwap.sol         # 自动化单元测试
│   ├── ManualTestNuaaSwap.sol   # 手动交互测试
│   └── README_测试说明.md       # 详细测试指南
├── artifacts/             # 编译产物
└── .deps/                 # 依赖管理
```

## 🚀 快速开始

### 环境要求

- **Solidity**: ^0.8.20
- **开发环境**: Remix IDE（推荐）或 Hardhat
- **网络**: 以太坊测试网或本地网络

### 部署步骤

1. **克隆项目**
```bash
git clone [<项目地址>](https://github.com/lifeprompter/nuaa_swap)
cd nuaa_swap
```

2. **在 Remix IDE 中打开**
   - 访问 https://remix.ethereum.org/
   - 导入项目文件夹
   - 确保 Solidity 编译器版本设置为 0.8.20

3. **编译合约**
   - 编译 `contracts/corn_a.sol`
   - 编译 `contracts/corn_b.sol`  
   - 编译 `contracts/nuaa_swap.sol`

4. **部署合约**
   ```solidity
   // 1. 部署 TokenA
   TokenA tokenA = new TokenA();
   
   // 2. 部署 TokenB  
   TokenB tokenB = new TokenB();
   
   // 3. 部署 NuaaSwap（传入两个代币地址）
   NuaaSwap swap = new NuaaSwap(address(tokenA), address(tokenB));
   ```

## 💡 使用指南

### 基本操作流程

#### 1. 授权代币
在进行任何操作前，需要授权合约使用您的代币：
```solidity
tokenA.approve(swapAddress, amount);
tokenB.approve(swapAddress, amount);
```

#### 2. 添加流动性
```solidity
// 添加 1000 TokenA 和 2000 TokenB 的流动性
swap.add_liquidity(1000 * 10**18, 2000 * 10**18);
```

#### 3. 进行代币交换
```solidity
// 将 100 TokenA 交换为 TokenB，最小输出量为 190，截止时间为当前时间+300秒
swap.swap(
    address(tokenA),           // 输入代币
    100 * 10**18,             // 输入数量
    190 * 10**18,             // 最小输出数量（滑点保护）
    block.timestamp + 300     // 交易截止时间
);
```

#### 4. 移除流动性
```solidity
// 移除指定数量的流动性份额
swap.remove_liquidity(shares);
```

### 管理员功能

#### 设置协议费用
```solidity
// 设置 0.5% 的协议费用（50 基点）
swap.setProtocolFee(50);
```

#### 设置费用接收地址
```solidity
swap.setFeeTo(feeReceiverAddress);
```

#### 暂停/恢复合约
```solidity
swap.pause();    // 暂停合约
swap.unpause();  // 恢复合约
```

## 🧪 测试指南

项目提供了两种测试方式：

### 自动化测试（推荐）
使用 `TestNuaaSwap.sol` 进行完整的单元测试：
```bash
# 在 Remix 中
1. 打开 "Solidity Unit Testing" 插件
2. 选择 tests/TestNuaaSwap.sol
3. 点击 "Run" 执行所有测试
```

### 手动交互测试
使用 `ManualTestNuaaSwap.sol` 进行逐步测试：
详细步骤请参考 [测试说明文档](tests/README_测试说明.md)

## 🔧 技术细节

### AMM 算法实现

```solidity
// 恒定乘积公式：x * y = k
// 交换计算（含 0.3% 手续费）
uint amountInWithFee = amountIn * 997;
uint numerator = amountInWithFee * reserveOut;
uint denominator = (reserveIn * 1000) + amountInWithFee;
uint amountOut = numerator / denominator;
```

### 流动性计算

```solidity
// 初次添加流动性
if (totalShares == 0) {
    shares = sqrt(amount0 * amount1);
}
// 后续添加流动性
else {
    shares = min(
        (amount0 * totalShares) / reserve0,
        (amount1 * totalShares) / reserve1
    );
}
```

### 合约特性

- **重入保护**: 使用 OpenZeppelin 的 `ReentrancyGuard`
- **权限管理**: 继承 `Ownable` 实现管理员功能
- **暂停机制**: 集成 `Pausable` 用于紧急情况
- **滑点保护**: 交换时检查最小输出量
- **时间锁**: 交易截止时间验证

## 🛡️ 安全考虑

### 已实现的安全措施

1. **重入攻击防护**: 使用 `nonReentrant` 修饰符
2. **整数溢出保护**: Solidity 0.8+ 内置溢出检查
3. **权限控制**: 管理员功能仅限合约所有者
4. **滑点保护**: 用户可设置最小输出量
5. **时间验证**: 防止过期交易执行

### 风险提示

- **无常损失**: 流动性提供者面临的固有风险
- **智能合约风险**: 代码可能存在未知漏洞
- **价格操纵**: 小池子容易受到价格操纵

## 📊 合约信息

| 参数 | 说明 |
|------|------|
| 交易费用 | 0.3% (固定) |
| 协议费用 | 0-10% (可配置) |
| 最小流动性 | 1000 wei |
| Gas 优化 | 使用 `immutable` 和 `packed` 存储 |


## 📚 相关资源

- [Uniswap V2 白皮书](https://uniswap.org/whitepaper.pdf)
- [OpenZeppelin 合约库](https://openzeppelin.com/contracts/)
- [Solidity 官方文档](https://docs.soliditylang.org/)

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 👥 团队信息

**南京航空航天大学区块链课程项目**

---

*⚠️ 免责声明：本项目仅用于教育目的，不应在生产环境中使用。使用前请进行全面的安全审计。*
