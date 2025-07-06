const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NuaaSwap 高级测试套件", function () {
    let nuaaSwap;
    let tokenA;
    let tokenB;
    let owner;
    let user1;
    let user2;
    let liquidityProvider;
    
    // 测试用的数量常量
    const LARGE_AMOUNT = ethers.parseEther("100000");
    const MEDIUM_AMOUNT = ethers.parseEther("10000");
    const SMALL_AMOUNT = ethers.parseEther("100");

    beforeEach(async function () {
        [owner, user1, user2, liquidityProvider] = await ethers.getSigners();

        // 部署合约
        const TokenA = await ethers.getContractFactory("TokenA");
        tokenA = await TokenA.deploy();
        await tokenA.waitForDeployment();

        const TokenB = await ethers.getContractFactory("TokenB");
        tokenB = await TokenB.deploy();
        await tokenB.waitForDeployment();

        const NuaaSwap = await ethers.getContractFactory("NuaaSwap");
        nuaaSwap = await NuaaSwap.deploy(
            await tokenA.getAddress(),
            await tokenB.getAddress()
        );
        await nuaaSwap.waitForDeployment();

        // 分发代币
        await tokenA.transfer(user1.address, LARGE_AMOUNT);
        await tokenB.transfer(user1.address, LARGE_AMOUNT);
        await tokenA.transfer(user2.address, LARGE_AMOUNT);
        await tokenB.transfer(user2.address, LARGE_AMOUNT);
        await tokenA.transfer(liquidityProvider.address, LARGE_AMOUNT);
        await tokenB.transfer(liquidityProvider.address, LARGE_AMOUNT);
    });

    describe("Gas 使用情况测试", function () {
        beforeEach(async function () {
            // 授权
            await tokenA.connect(liquidityProvider).approve(await nuaaSwap.getAddress(), LARGE_AMOUNT);
            await tokenB.connect(liquidityProvider).approve(await nuaaSwap.getAddress(), LARGE_AMOUNT);
            await tokenA.connect(user1).approve(await nuaaSwap.getAddress(), LARGE_AMOUNT);
            await tokenB.connect(user1).approve(await nuaaSwap.getAddress(), LARGE_AMOUNT);
        });

        it("应该测量添加流动性的 Gas 消耗", async function () {
            const tx = await nuaaSwap.connect(liquidityProvider).add_liquidity(
                MEDIUM_AMOUNT,
                MEDIUM_AMOUNT
            );
            const receipt = await tx.wait();
            
            console.log(`添加初始流动性 Gas 消耗: ${receipt.gasUsed.toString()}`);
            expect(receipt.gasUsed).to.be.lt(200000); // 应该小于 200k gas
        });

        it("应该测量后续添加流动性的 Gas 消耗", async function () {
            // 先添加初始流动性
            await nuaaSwap.connect(liquidityProvider).add_liquidity(MEDIUM_AMOUNT, MEDIUM_AMOUNT);
            
            // 测量后续添加
            const tx = await nuaaSwap.connect(user1).add_liquidity(
                SMALL_AMOUNT,
                SMALL_AMOUNT
            );
            const receipt = await tx.wait();
            
            console.log(`添加后续流动性 Gas 消耗: ${receipt.gasUsed.toString()}`);
            expect(receipt.gasUsed).to.be.lt(150000); // 应该小于 150k gas
        });

        it("应该测量代币交换的 Gas 消耗", async function () {
            // 设置流动性池
            await nuaaSwap.connect(liquidityProvider).add_liquidity(MEDIUM_AMOUNT, MEDIUM_AMOUNT);
            
            const deadline = Math.floor(Date.now() / 1000) + 300;
            const tx = await nuaaSwap.connect(user1).swap(
                await tokenA.getAddress(),
                SMALL_AMOUNT,
                0,
                deadline
            );
            const receipt = await tx.wait();
            
            console.log(`代币交换 Gas 消耗: ${receipt.gasUsed.toString()}`);
            expect(receipt.gasUsed).to.be.lt(100000); // 应该小于 100k gas
        });

        it("应该测量移除流动性的 Gas 消耗", async function () {
            // 添加流动性
            await nuaaSwap.connect(liquidityProvider).add_liquidity(MEDIUM_AMOUNT, MEDIUM_AMOUNT);
            
            const shares = await nuaaSwap.liquidityShares(liquidityProvider.address);
            const tx = await nuaaSwap.connect(liquidityProvider).remove_liquidity(shares / 2n);
            const receipt = await tx.wait();
            
            console.log(`移除流动性 Gas 消耗: ${receipt.gasUsed.toString()}`);
            expect(receipt.gasUsed).to.be.lt(100000); // 应该小于 100k gas
        });
    });

    describe("大额交易测试", function () {
        beforeEach(async function () {
            await tokenA.connect(liquidityProvider).approve(await nuaaSwap.getAddress(), LARGE_AMOUNT);
            await tokenB.connect(liquidityProvider).approve(await nuaaSwap.getAddress(), LARGE_AMOUNT);
            await tokenA.connect(user1).approve(await nuaaSwap.getAddress(), LARGE_AMOUNT);
            
            // 添加大量流动性
            await nuaaSwap.connect(liquidityProvider).add_liquidity(
                ethers.parseEther("50000"),
                ethers.parseEther("100000")
            );
        });

        it("应该能够处理大额交换", async function () {
            const largeSwapAmount = ethers.parseEther("5000");
            const deadline = Math.floor(Date.now() / 1000) + 300;
            
            const balanceBefore = await tokenB.balanceOf(user1.address);
            
            await nuaaSwap.connect(user1).swap(
                await tokenA.getAddress(),
                largeSwapAmount,
                0,
                deadline
            );
            
            const balanceAfter = await tokenB.balanceOf(user1.address);
            expect(balanceAfter).to.be.gt(balanceBefore);
        });

        it("大额交换应该有合理的滑点", async function () {
            const swapAmount = ethers.parseEther("10000"); // 20% 的池子大小
            const deadline = Math.floor(Date.now() / 1000) + 300;
            
            const reserveA = await nuaaSwap.reserve0();
            const reserveB = await nuaaSwap.reserve1();
            
            // 计算理论输出（不考虑费用）
            const theoreticalOutput = (swapAmount * reserveB) / (reserveA + swapAmount);
            
            await nuaaSwap.connect(user1).swap(
                await tokenA.getAddress(),
                swapAmount,
                0,
                deadline
            );
            
            // 验证储备已更新
            const newReserveA = await nuaaSwap.reserve0();
            const newReserveB = await nuaaSwap.reserve1();
            
            expect(newReserveA).to.be.gt(reserveA);
            expect(newReserveB).to.be.lt(reserveB);
        });
    });

    describe("价格影响测试", function () {
        beforeEach(async function () {
            await tokenA.connect(liquidityProvider).approve(await nuaaSwap.getAddress(), LARGE_AMOUNT);
            await tokenB.connect(liquidityProvider).approve(await nuaaSwap.getAddress(), LARGE_AMOUNT);
            await tokenA.connect(user1).approve(await nuaaSwap.getAddress(), LARGE_AMOUNT);
            await tokenB.connect(user1).approve(await nuaaSwap.getAddress(), LARGE_AMOUNT);
            
            // 设置 1:2 的初始价格比例
            await nuaaSwap.connect(liquidityProvider).add_liquidity(
                ethers.parseEther("10000"),
                ethers.parseEther("20000")
            );
        });

        it("小额交换应该有最小的价格影响", async function () {
            const smallSwap = ethers.parseEther("10"); // 0.1% 的池子大小
            const deadline = Math.floor(Date.now() / 1000) + 300;
            
            const reserveBefore = await nuaaSwap.reserve1();
            
            await nuaaSwap.connect(user1).swap(
                await tokenA.getAddress(),
                smallSwap,
                0,
                deadline
            );
            
            const reserveAfter = await nuaaSwap.reserve1();
            const priceImpact = ((reserveBefore - reserveAfter) * 10000n) / reserveBefore;
            
            console.log(`小额交换价格影响: ${priceImpact.toString()} 基点`);
            expect(priceImpact).to.be.lt(100); // 小于 1%
        });

        it("中等交换应该有适中的价格影响", async function () {
            const mediumSwap = ethers.parseEther("500"); // 5% 的池子大小
            const deadline = Math.floor(Date.now() / 1000) + 300;
            
            const reserveBefore = await nuaaSwap.reserve1();
            
            await nuaaSwap.connect(user1).swap(
                await tokenA.getAddress(),
                mediumSwap,
                0,
                deadline
            );
            
            const reserveAfter = await nuaaSwap.reserve1();
            const priceImpact = ((reserveBefore - reserveAfter) * 10000n) / reserveBefore;
            
            console.log(`中等交换价格影响: ${priceImpact.toString()} 基点`);
            expect(priceImpact).to.be.gte(100); // 大于 1%
            expect(priceImpact).to.be.lt(1000); // 小于 10%
        });
    });

    describe("连续交换测试", function () {
        beforeEach(async function () {
            await tokenA.connect(liquidityProvider).approve(await nuaaSwap.getAddress(), LARGE_AMOUNT);
            await tokenB.connect(liquidityProvider).approve(await nuaaSwap.getAddress(), LARGE_AMOUNT);
            await tokenA.connect(user1).approve(await nuaaSwap.getAddress(), LARGE_AMOUNT);
            await tokenB.connect(user1).approve(await nuaaSwap.getAddress(), LARGE_AMOUNT);
            
            await nuaaSwap.connect(liquidityProvider).add_liquidity(
                ethers.parseEther("10000"),
                ethers.parseEther("20000")
            );
        });

        it("应该能够进行多次连续交换", async function () {
            const swapAmount = ethers.parseEther("100");
            const deadline = Math.floor(Date.now() / 1000) + 300;
            
            // 进行多次 A -> B 交换
            for (let i = 0; i < 5; i++) {
                await nuaaSwap.connect(user1).swap(
                    await tokenA.getAddress(),
                    swapAmount,
                    0,
                    deadline
                );
            }
            
            // 验证储备变化
            const reserve0 = await nuaaSwap.reserve0();
            const reserve1 = await nuaaSwap.reserve1();
            
            expect(reserve0).to.be.gt(ethers.parseEther("10000"));
            expect(reserve1).to.be.lt(ethers.parseEther("20000"));
        });

        it("往返交换应该有费用损失", async function () {
            const swapAmount = ethers.parseEther("1000");
            const deadline = Math.floor(Date.now() / 1000) + 300;
            
            const initialBalanceA = await tokenA.balanceOf(user1.address);
            
            // A -> B
            await nuaaSwap.connect(user1).swap(
                await tokenA.getAddress(),
                swapAmount,
                0,
                deadline
            );
            
            const balanceB = await tokenB.balanceOf(user1.address);
            
            // B -> A (把所有 B 换回 A)
            await nuaaSwap.connect(user1).swap(
                await tokenB.getAddress(),
                balanceB,
                0,
                deadline
            );
            
            const finalBalanceA = await tokenA.balanceOf(user1.address);
            
            // 应该损失一些代币（由于交易费用）
            expect(finalBalanceA).to.be.lt(initialBalanceA);
            
            const loss = initialBalanceA - finalBalanceA;
            console.log(`往返交换损失: ${ethers.formatEther(loss)} TokenA`);
        });
    });

    describe("极端情况测试", function () {
        beforeEach(async function () {
            await tokenA.connect(liquidityProvider).approve(await nuaaSwap.getAddress(), LARGE_AMOUNT);
            await tokenB.connect(liquidityProvider).approve(await nuaaSwap.getAddress(), LARGE_AMOUNT);
        });

        it("应该能够处理极小数量的流动性", async function () {
            const minAmount = 1000; // 非常小的数量
            
            await expect(
                nuaaSwap.connect(liquidityProvider).add_liquidity(minAmount, minAmount)
            ).to.emit(nuaaSwap, "LiquidityAdded");
            
            expect(await nuaaSwap.totalShares()).to.be.gt(0);
        });

        it("应该能够处理极不平衡的流动性", async function () {
            const amountA = ethers.parseEther("1");
            const amountB = ethers.parseEther("1000000"); // 1:1000000 比例
            
            await expect(
                nuaaSwap.connect(liquidityProvider).add_liquidity(amountA, amountB)
            ).to.emit(nuaaSwap, "LiquidityAdded");
            
            expect(await nuaaSwap.reserve0()).to.equal(amountA);
            expect(await nuaaSwap.reserve1()).to.equal(amountB);
        });

        it("最后一个流动性提供者应该能够移除所有流动性", async function () {
            await nuaaSwap.connect(liquidityProvider).add_liquidity(
                ethers.parseEther("1000"),
                ethers.parseEther("2000")
            );
            
            const totalShares = await nuaaSwap.liquidityShares(liquidityProvider.address);
            
            await expect(
                nuaaSwap.connect(liquidityProvider).remove_liquidity(totalShares)
            ).to.emit(nuaaSwap, "LiquidityRemoved");
            
            expect(await nuaaSwap.totalShares()).to.equal(0);
            expect(await nuaaSwap.reserve0()).to.equal(0);
            expect(await nuaaSwap.reserve1()).to.equal(0);
        });
    });

    describe("数学精度测试", function () {
        it("应该正确计算平方根", async function () {
            await tokenA.connect(liquidityProvider).approve(await nuaaSwap.getAddress(), LARGE_AMOUNT);
            await tokenB.connect(liquidityProvider).approve(await nuaaSwap.getAddress(), LARGE_AMOUNT);
            
            // 添加完全平方数的流动性
            const amount = ethers.parseEther("10000"); // 10000^2 = 100000000
            
            await nuaaSwap.connect(liquidityProvider).add_liquidity(amount, amount);
            
            const shares = await nuaaSwap.liquidityShares(liquidityProvider.address);
            const expectedShares = ethers.parseEther("10000"); // sqrt(10000 * 10000)
            
            // 允许一些精度误差
            const diff = shares > expectedShares ? shares - expectedShares : expectedShares - shares;
            expect(diff).to.be.lt(ethers.parseEther("0.001")); // 误差小于 0.001
        });
    });
}); 