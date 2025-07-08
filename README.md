# NuaaSwap - 去中心化交易所

这是南京航空航天大学区块链课程的期末考试项目，实现了一个基于以太坊的去中心化交易所（DEX）。

> 🎯 这是一个额外**项目**：额外采用 **Hardhat 专业开发框架**，包含完整的测试套件和自动化部署脚本。

## 📋 项目概述

NuaaSwap 是一个基于自动做市商（AMM）模型的去中心化交易所，采用恒定乘积公式（x * y = k）实现代币交换。该项目包含完整的智能合约实现、专业级测试套件和部署脚本。

### 🎯 核心功能

- **流动性管理**：添加和移除流动性池
- **代币交换**：基于 AMM 算法的自动代币交换
- **费用机制**：0.3% 交易费用 + 可配置协议费用
- **安全保护**：重入攻击防护、滑点保护、权限管理
- **管理功能**：合约暂停/恢复、费用配置


## 🏗️ 项目架构

```
nuaa_swap/
├── contracts/                    # 智能合约
│   ├── nuaa_swap.sol            # 核心交换合约
│   ├── corn_a.sol               # 测试代币 A
│   └── corn_b.sol               # 测试代币 B
├── hardhat_tests/               # Hardhat 测试套件
│   └── NuaaSwap.test.js         # 全面功能测试
├── scripts/                     # 部署脚本
│   └── deploy.js                # 自动化部署
├── package.json                 # 项目依赖配置
├── hardhat.config.js            # Hardhat 配置
├── artifacts/                   # 编译产物
├── cache/                       # 编译缓存
└── .deps/                       # 依赖管理
```

## 🚀 Hardhat 快速开始

### 环境要求

- **Node.js**: v16+ 
- **npm**: v8+
- **Solidity**: ^0.8.20
- **开发环境**: Hardhat

### Hardhat 部署步骤

1. **克隆项目**
```bash
git clone [<项目地址>](https://github.com/lifeprompter/nuaa_swap)
cd nuaa_swap
```

2. **安装依赖**
```bash
npm install
```

3. **编译合约**
```bash
npx hardhat compile
```

4. **运行测试套件**
```bash
# 运行测试文件
npx hardhat test

# 生成覆盖率报告
npx hardhat coverage

# 启用Gas报告（可选）
REPORT_GAS=true npx hardhat test
```

5. **部署合约**
```bash
# 启动本地测试网络
npx hardhat node

# 部署到本地网络
npx hardhat run scripts/deploy.js --network localhost
```

## 🧪 脚本测试

### 测试覆盖范围

✅ **合约部署验证**
- 代币地址正确性
- 初始状态验证

✅ **流动性管理测试**
- 初始流动性添加
- 后续流动性添加
- 流动性移除
- 边界条件处理

✅ **代币交换功能**
- A→B 交换测试
- B→A 交换测试
- 无效代币拒绝
- 过期交易拒绝

✅ **管理功能测试**
- 协议费用设置
- 费用接收地址设置
- 权限控制验证

✅ **安全机制测试**
- 暂停机制测试
- 权限控制验证
- 边界条件处理

✅ **协议费用机制**
- 费用收取验证
- 费用分配测试

### 测试框架特点

🔥 **专业测试工具**
```
- 使用 Chai 断言库
- 事件触发验证
- 多账户测试场景
- 错误情况处理
```

### 测试运行示例

```bash
$ npx hardhat test

  NuaaSwap
    合约部署
      ✔ 应该正确设置代币地址
      ✔ 应该初始化为零值
    流动性管理
      ✔ 应该能够添加初始流动性
      ✔ 应该能够添加更多流动性
      ✔ 应该能够移除流动性
    代币交换
      ✔ 应该能够进行 A -> B 代币交换
      ✔ 应该能够进行 B -> A 代币交换
      ✔ 应该拒绝无效代币交换
      ✔ 应该拒绝过期的交换
    管理功能
      ✔ 应该能够设置协议费用
      ✔ 应该拒绝过高的协议费用
      ✔ 应该能够设置费用接收地址
      ✔ 非所有者不应该能够设置费用
    暂停功能
      ✔ 应该能够暂停合约
      ✔ 应该能够取消暂停合约
      ✔ 非所有者不应该能够暂停合约
    协议费用测试
      ✔ 应该在交换时收取协议费用
    边界条件测试
      ✔ 应该拒绝添加零流动性
      ✔ 应该拒绝移除超过拥有的流动性份额

  19 passing (710ms)
```

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


## 📚 相关资源

- [Hardhat 使用指南](./HARDHAT_README.md) - 详细的 Hardhat 操作说明
- [Uniswap V2 白皮书](https://uniswap.org/whitepaper.pdf)
- [OpenZeppelin 合约库](https://openzeppelin.com/contracts/)
- [Solidity 官方文档](https://docs.soliditylang.org/)
- [Hardhat 官方文档](https://hardhat.org/docs)

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 👥 团队信息

**由 [codeprompter](https://github.com/codeprompter) 独立完成撰写**

---

*⚠️ 免责声明：本项目仅用于教育目的，不应在生产环境中使用。使用前请进行全面的安全审计。*

---
