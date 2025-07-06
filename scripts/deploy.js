const { ethers } = require("hardhat");

async function main() {
    console.log("开始部署 NuaaSwap 合约...");

    // 获取部署账户
    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);
    console.log("账户余额:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

    try {
        // 1. 部署 TokenA
        console.log("\n📦 部署 TokenA...");
        const TokenA = await ethers.getContractFactory("TokenA");
        const tokenA = await TokenA.deploy();
        await tokenA.waitForDeployment();
        const tokenAAddress = await tokenA.getAddress();
        console.log("✅ TokenA 部署成功:", tokenAAddress);

        // 2. 部署 TokenB
        console.log("\n📦 部署 TokenB...");
        const TokenB = await ethers.getContractFactory("TokenB");
        const tokenB = await TokenB.deploy();
        await tokenB.waitForDeployment();
        const tokenBAddress = await tokenB.getAddress();
        console.log("✅ TokenB 部署成功:", tokenBAddress);

        // 3. 部署 NuaaSwap
        console.log("\n📦 部署 NuaaSwap...");
        const NuaaSwap = await ethers.getContractFactory("NuaaSwap");
        const nuaaSwap = await NuaaSwap.deploy(tokenAAddress, tokenBAddress);
        await nuaaSwap.waitForDeployment();
        const nuaaSwapAddress = await nuaaSwap.getAddress();
        console.log("✅ NuaaSwap 部署成功:", nuaaSwapAddress);

        // 4. 验证部署结果
        console.log("\n🔍 验证部署结果...");
        console.log("TokenA 名称:", await tokenA.name());
        console.log("TokenA 符号:", await tokenA.symbol());
        console.log("TokenA 总供应量:", ethers.formatEther(await tokenA.totalSupply()));
        
        console.log("TokenB 名称:", await tokenB.name());
        console.log("TokenB 符号:", await tokenB.symbol());
        console.log("TokenB 总供应量:", ethers.formatEther(await tokenB.totalSupply()));

        console.log("NuaaSwap token0:", await nuaaSwap.token0());
        console.log("NuaaSwap token1:", await nuaaSwap.token1());
        console.log("NuaaSwap 所有者:", await nuaaSwap.owner());

        // 5. 保存部署信息
        const deploymentInfo = {
            network: hre.network.name,
            deployer: deployer.address,
            contracts: {
                TokenA: {
                    address: tokenAAddress,
                    name: await tokenA.name(),
                    symbol: await tokenA.symbol()
                },
                TokenB: {
                    address: tokenBAddress,
                    name: await tokenB.name(),
                    symbol: await tokenB.symbol()
                },
                NuaaSwap: {
                    address: nuaaSwapAddress,
                    token0: await nuaaSwap.token0(),
                    token1: await nuaaSwap.token1()
                }
            },
            timestamp: new Date().toISOString()
        };

        console.log("\n📋 部署总结:");
        console.log("==========================================");
        console.log("网络:", hre.network.name);
        console.log("TokenA 地址:", tokenAAddress);
        console.log("TokenB 地址:", tokenBAddress);
        console.log("NuaaSwap 地址:", nuaaSwapAddress);
        console.log("==========================================");

        // 输出使用说明
        console.log("\n📖 使用说明:");
        console.log("1. 在 Remix 中导入这些合约地址");
        console.log("2. 首先授权 NuaaSwap 合约使用你的代币:");
        console.log(`   tokenA.approve("${nuaaSwapAddress}", amount)`);
        console.log(`   tokenB.approve("${nuaaSwapAddress}", amount)`);
        console.log("3. 然后就可以添加流动性和进行交换了！");

        return deploymentInfo;

    } catch (error) {
        console.error("❌ 部署失败:", error);
        throw error;
    }
}

// 如果直接运行此脚本则执行部署
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = main; 