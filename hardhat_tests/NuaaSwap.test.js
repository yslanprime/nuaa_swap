const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NuaaSwap 去中心化交易所测试", function () {
    let nuaaSwap;
    let tokenA;
    let tokenB;
    let owner;
    let user1;
    let user2;
    let feeReceiver;
    
    // 测试用的数量常量
    const INITIAL_SUPPLY = ethers.parseEther("1000000");
    const LIQUIDITY_AMOUNT_A = ethers.parseEther("1000");
    const LIQUIDITY_AMOUNT_B = ethers.parseEther("2000");
    const SWAP_AMOUNT = ethers.parseEther("100");

    beforeEach(async function () {
        // 获取测试账户
        [owner, user1, user2, feeReceiver] = await ethers.getSigners();

        // 部署 TokenA
        const TokenA = await ethers.getContractFactory("TokenA");
        tokenA = await TokenA.deploy();
        await tokenA.waitForDeployment();

        // 部署 TokenB
        const TokenB = await ethers.getContractFactory("TokenB");
        tokenB = await TokenB.deploy();
        await tokenB.waitForDeployment();

        // 部署 NuaaSwap
        const NuaaSwap = await ethers.getContractFactory("NuaaSwap");
        nuaaSwap = await NuaaSwap.deploy(
            await tokenA.getAddress(),
            await tokenB.getAddress()
        );
        await nuaaSwap.waitForDeployment();

        // 给用户转一些代币
        await tokenA.transfer(user1.address, ethers.parseEther("10000"));
        await tokenB.transfer(user1.address, ethers.parseEther("10000"));
        await tokenA.transfer(user2.address, ethers.parseEther("10000"));
        await tokenB.transfer(user2.address, ethers.parseEther("10000"));
    });

    describe("合约部署测试", function () {
        it("应该正确设置代币地址", async function () {
            expect(await nuaaSwap.token0()).to.equal(await tokenA.getAddress());
            expect(await nuaaSwap.token1()).to.equal(await tokenB.getAddress());
        });

        it("应该设置正确的合约所有者", async function () {
            expect(await nuaaSwap.owner()).to.equal(owner.address);
        });

        it("代币应该有正确的初始供应量", async function () {
            expect(await tokenA.totalSupply()).to.equal(INITIAL_SUPPLY);
            expect(await tokenB.totalSupply()).to.equal(INITIAL_SUPPLY);
        });
    });

    describe("流动性管理测试", function () {
        beforeEach(async function () {
            // 授权合约使用用户的代币
            await tokenA.connect(user1).approve(await nuaaSwap.getAddress(), ethers.parseEther("100000"));
            await tokenB.connect(user1).approve(await nuaaSwap.getAddress(), ethers.parseEther("100000"));
        });

        it("应该能够添加初始流动性", async function () {
            await expect(
                nuaaSwap.connect(user1).add_liquidity(LIQUIDITY_AMOUNT_A, LIQUIDITY_AMOUNT_B)
            ).to.emit(nuaaSwap, "LiquidityAdded")
            .withArgs(user1.address, LIQUIDITY_AMOUNT_A, LIQUIDITY_AMOUNT_B, ethers.parseEther("1414.213562373095048801")); // sqrt(1000*2000)

            expect(await nuaaSwap.reserve0()).to.equal(LIQUIDITY_AMOUNT_A);
            expect(await nuaaSwap.reserve1()).to.equal(LIQUIDITY_AMOUNT_B);
            expect(await nuaaSwap.totalShares()).to.be.gt(0);
        });

        it("应该能够添加后续流动性", async function () {
            // 添加初始流动性
            await nuaaSwap.connect(user1).add_liquidity(LIQUIDITY_AMOUNT_A, LIQUIDITY_AMOUNT_B);
            
            // 授权第二个用户
            await tokenA.connect(user2).approve(await nuaaSwap.getAddress(), ethers.parseEther("100000"));
            await tokenB.connect(user2).approve(await nuaaSwap.getAddress(), ethers.parseEther("100000"));
            
            // 添加后续流动性
            const additionalA = ethers.parseEther("500");
            const additionalB = ethers.parseEther("1000");
            
            await expect(
                nuaaSwap.connect(user2).add_liquidity(additionalA, additionalB)
            ).to.emit(nuaaSwap, "LiquidityAdded");

            expect(await nuaaSwap.reserve0()).to.equal(LIQUIDITY_AMOUNT_A + additionalA);
            expect(await nuaaSwap.reserve1()).to.equal(LIQUIDITY_AMOUNT_B + additionalB);
        });

        it("应该能够移除流动性", async function () {
            // 先添加流动性
            await nuaaSwap.connect(user1).add_liquidity(LIQUIDITY_AMOUNT_A, LIQUIDITY_AMOUNT_B);
            
            const userShares = await nuaaSwap.liquidityShares(user1.address);
            const halfShares = userShares / 2n;
            
            await expect(
                nuaaSwap.connect(user1).remove_liquidity(halfShares)
            ).to.emit(nuaaSwap, "LiquidityRemoved");

            expect(await nuaaSwap.liquidityShares(user1.address)).to.equal(userShares - halfShares);
        });

        it("移除超过拥有数量的流动性应该失败", async function () {
            await nuaaSwap.connect(user1).add_liquidity(LIQUIDITY_AMOUNT_A, LIQUIDITY_AMOUNT_B);
            
            const userShares = await nuaaSwap.liquidityShares(user1.address);
            const excessiveShares = userShares + 1n;
            
            await expect(
                nuaaSwap.connect(user1).remove_liquidity(excessiveShares)
            ).to.be.revertedWith("NuaaSwap: INSUFFICIENT_SHARES");
        });
    });

    describe("代币交换测试", function () {
        beforeEach(async function () {
            // 设置流动性池
            await tokenA.connect(user1).approve(await nuaaSwap.getAddress(), ethers.parseEther("100000"));
            await tokenB.connect(user1).approve(await nuaaSwap.getAddress(), ethers.parseEther("100000"));
            await nuaaSwap.connect(user1).add_liquidity(LIQUIDITY_AMOUNT_A, LIQUIDITY_AMOUNT_B);
            
            // 为交换用户授权
            await tokenA.connect(user2).approve(await nuaaSwap.getAddress(), ethers.parseEther("100000"));
            await tokenB.connect(user2).approve(await nuaaSwap.getAddress(), ethers.parseEther("100000"));
        });

        it("应该能够进行 TokenA 到 TokenB 的交换", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 300; // 5分钟后过期
            const minAmountOut = ethers.parseEther("190"); // 最小输出量
            
            const balanceBefore = await tokenB.balanceOf(user2.address);
            
            await expect(
                nuaaSwap.connect(user2).swap(
                    await tokenA.getAddress(),
                    SWAP_AMOUNT,
                    minAmountOut,
                    deadline
                )
            ).to.emit(nuaaSwap, "Swapped");

            const balanceAfter = await tokenB.balanceOf(user2.address);
            expect(balanceAfter).to.be.gt(balanceBefore);
        });

        it("应该能够进行 TokenB 到 TokenA 的交换", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 300;
            const minAmountOut = ethers.parseEther("45"); // 最小输出量
            
            const balanceBefore = await tokenA.balanceOf(user2.address);
            
            await expect(
                nuaaSwap.connect(user2).swap(
                    await tokenB.getAddress(),
                    SWAP_AMOUNT,
                    minAmountOut,
                    deadline
                )
            ).to.emit(nuaaSwap, "Swapped");

            const balanceAfter = await tokenA.balanceOf(user2.address);
            expect(balanceAfter).to.be.gt(balanceBefore);
        });

        it("滑点保护应该工作", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 300;
            const unreasonableMinAmountOut = ethers.parseEther("500"); // 不合理的最小输出量
            
            await expect(
                nuaaSwap.connect(user2).swap(
                    await tokenA.getAddress(),
                    SWAP_AMOUNT,
                    unreasonableMinAmountOut,
                    deadline
                )
            ).to.be.revertedWith("NuaaSwap: INSUFFICIENT_OUTPUT_AMOUNT");
        });

        it("过期交易应该被拒绝", async function () {
            const expiredDeadline = Math.floor(Date.now() / 1000) - 300; // 已经过期
            const minAmountOut = ethers.parseEther("190");
            
            await expect(
                nuaaSwap.connect(user2).swap(
                    await tokenA.getAddress(),
                    SWAP_AMOUNT,
                    minAmountOut,
                    expiredDeadline
                )
            ).to.be.revertedWith("NuaaSwap: DEADLINE_EXPIRED");
        });

        it("无效代币交换应该失败", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 300;
            const minAmountOut = ethers.parseEther("190");
            
            await expect(
                nuaaSwap.connect(user2).swap(
                    ethers.ZeroAddress, // 无效代币地址
                    SWAP_AMOUNT,
                    minAmountOut,
                    deadline
                )
            ).to.be.revertedWith("NuaaSwap: INVALID_TOKEN");
        });
    });

    describe("管理员功能测试", function () {
        it("应该能够设置协议费用", async function () {
            const newFee = 50; // 0.5%
            
            await expect(
                nuaaSwap.connect(owner).setProtocolFee(newFee)
            ).to.emit(nuaaSwap, "ProtocolFeeSet")
            .withArgs(0, newFee);

            expect(await nuaaSwap.protocolFeeBps()).to.equal(newFee);
        });

        it("设置过高的协议费用应该失败", async function () {
            const tooHighFee = 1001; // 超过10%
            
            await expect(
                nuaaSwap.connect(owner).setProtocolFee(tooHighFee)
            ).to.be.revertedWith("NuaaSwap: FEE_TOO_HIGH");
        });

        it("应该能够设置费用接收地址", async function () {
            await expect(
                nuaaSwap.connect(owner).setFeeTo(feeReceiver.address)
            ).to.emit(nuaaSwap, "FeeToSet")
            .withArgs(ethers.ZeroAddress, feeReceiver.address);

            expect(await nuaaSwap.feeTo()).to.equal(feeReceiver.address);
        });

        it("非所有者不能设置协议费用", async function () {
            await expect(
                nuaaSwap.connect(user1).setProtocolFee(50)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("应该能够暂停和恢复合约", async function () {
            // 暂停合约
            await nuaaSwap.connect(owner).pause();
            expect(await nuaaSwap.paused()).to.be.true;

            // 暂停时不能添加流动性
            await tokenA.connect(user1).approve(await nuaaSwap.getAddress(), ethers.parseEther("100000"));
            await tokenB.connect(user1).approve(await nuaaSwap.getAddress(), ethers.parseEther("100000"));
            
            await expect(
                nuaaSwap.connect(user1).add_liquidity(LIQUIDITY_AMOUNT_A, LIQUIDITY_AMOUNT_B)
            ).to.be.revertedWith("Pausable: paused");

            // 恢复合约
            await nuaaSwap.connect(owner).unpause();
            expect(await nuaaSwap.paused()).to.be.false;

            // 恢复后可以正常操作
            await expect(
                nuaaSwap.connect(user1).add_liquidity(LIQUIDITY_AMOUNT_A, LIQUIDITY_AMOUNT_B)
            ).to.emit(nuaaSwap, "LiquidityAdded");
        });
    });

    describe("协议费用功能测试", function () {
        beforeEach(async function () {
            // 设置协议费用和费用接收地址
            await nuaaSwap.connect(owner).setProtocolFee(100); // 1%
            await nuaaSwap.connect(owner).setFeeTo(feeReceiver.address);
            
            // 设置流动性池
            await tokenA.connect(user1).approve(await nuaaSwap.getAddress(), ethers.parseEther("100000"));
            await tokenB.connect(user1).approve(await nuaaSwap.getAddress(), ethers.parseEther("100000"));
            await nuaaSwap.connect(user1).add_liquidity(LIQUIDITY_AMOUNT_A, LIQUIDITY_AMOUNT_B);
            
            // 为交换用户授权
            await tokenA.connect(user2).approve(await nuaaSwap.getAddress(), ethers.parseEther("100000"));
        });

        it("交换时应该收取协议费用", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 300;
            const minAmountOut = ethers.parseEther("190");
            
            const feeReceiverBalanceBefore = await tokenB.balanceOf(feeReceiver.address);
            
            await nuaaSwap.connect(user2).swap(
                await tokenA.getAddress(),
                SWAP_AMOUNT,
                minAmountOut,
                deadline
            );
            
            const feeReceiverBalanceAfter = await tokenB.balanceOf(feeReceiver.address);
            expect(feeReceiverBalanceAfter).to.be.gt(feeReceiverBalanceBefore);
        });
    });

    describe("边界情况测试", function () {
        it("零流动性时不应该能够交换", async function () {
            await tokenA.connect(user1).approve(await nuaaSwap.getAddress(), ethers.parseEther("100000"));
            
            const deadline = Math.floor(Date.now() / 1000) + 300;
            
            await expect(
                nuaaSwap.connect(user1).swap(
                    await tokenA.getAddress(),
                    SWAP_AMOUNT,
                    0,
                    deadline
                )
            ).to.be.reverted; // 因为没有流动性，会导致除零错误
        });

        it("添加零流动性应该失败", async function () {
            await tokenA.connect(user1).approve(await nuaaSwap.getAddress(), ethers.parseEther("100000"));
            await tokenB.connect(user1).approve(await nuaaSwap.getAddress(), ethers.parseEther("100000"));
            
            await expect(
                nuaaSwap.connect(user1).add_liquidity(0, 0)
            ).to.be.revertedWith("NuaaSwap: INSUFFICIENT_LIQUIDITY_MINTED");
        });
    });
}); 