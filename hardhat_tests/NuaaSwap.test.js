const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NuaaSwap", function () {
  let swapContract;
  let tokenA;
  let tokenB;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  const INITIAL_LIQUIDITY_A = ethers.parseEther("1000");
  const INITIAL_LIQUIDITY_B = ethers.parseEther("2000");

  beforeEach(async function () {
    // 获取测试账户
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    // 部署代币合约
    const TokenA = await ethers.getContractFactory("TokenA");
    tokenA = await TokenA.deploy();
    await tokenA.waitForDeployment();

    const TokenB = await ethers.getContractFactory("TokenB");
    tokenB = await TokenB.deploy();
    await tokenB.waitForDeployment();

    // 部署交换合约
    const NuaaSwap = await ethers.getContractFactory("NuaaSwap");
    swapContract = await NuaaSwap.deploy(
      await tokenA.getAddress(),
      await tokenB.getAddress()
    );
    await swapContract.waitForDeployment();
  });

  describe("合约部署", function () {
    it("应该正确设置代币地址", async function () {
      expect(await swapContract.token0()).to.equal(await tokenA.getAddress());
      expect(await swapContract.token1()).to.equal(await tokenB.getAddress());
    });

    it("应该初始化为零值", async function () {
      expect(await swapContract.totalShares()).to.equal(0);
      expect(await swapContract.reserve0()).to.equal(0);
      expect(await swapContract.reserve1()).to.equal(0);
    });
  });

  describe("流动性管理", function () {
    it("应该能够添加初始流动性", async function () {
      // 批准合约使用代币
      await tokenA.approve(await swapContract.getAddress(), INITIAL_LIQUIDITY_A);
      await tokenB.approve(await swapContract.getAddress(), INITIAL_LIQUIDITY_B);

      // 添加流动性
      const tx = await swapContract.add_liquidity(INITIAL_LIQUIDITY_A, INITIAL_LIQUIDITY_B);
      const receipt = await tx.wait();

      // 检查结果
      expect(await swapContract.reserve0()).to.equal(INITIAL_LIQUIDITY_A);
      expect(await swapContract.reserve1()).to.equal(INITIAL_LIQUIDITY_B);
      
      const userShares = await swapContract.liquidityShares(owner.address);
      expect(userShares).to.be.gt(0);
      expect(await swapContract.totalShares()).to.equal(userShares);

      // 检查事件
      await expect(tx)
        .to.emit(swapContract, "LiquidityAdded")
        .withArgs(owner.address, INITIAL_LIQUIDITY_A, INITIAL_LIQUIDITY_B, userShares);
    });

    it("应该能够添加更多流动性", async function () {
      // 先添加初始流动性
      await tokenA.approve(await swapContract.getAddress(), INITIAL_LIQUIDITY_A);
      await tokenB.approve(await swapContract.getAddress(), INITIAL_LIQUIDITY_B);
      await swapContract.add_liquidity(INITIAL_LIQUIDITY_A, INITIAL_LIQUIDITY_B);

      // 添加更多流动性
      const addAmount0 = ethers.parseEther("500");
      const addAmount1 = ethers.parseEther("1000");

      await tokenA.approve(await swapContract.getAddress(), addAmount0);
      await tokenB.approve(await swapContract.getAddress(), addAmount1);

      const sharesBefore = await swapContract.totalShares();
      const tx = await swapContract.add_liquidity(addAmount0, addAmount1);
      const receipt = await tx.wait();

      const sharesAfter = await swapContract.totalShares();
      expect(sharesAfter).to.be.gt(sharesBefore);
    });

    it("应该能够移除流动性", async function () {
      // 先添加流动性
      await tokenA.approve(await swapContract.getAddress(), INITIAL_LIQUIDITY_A);
      await tokenB.approve(await swapContract.getAddress(), INITIAL_LIQUIDITY_B);
      await swapContract.add_liquidity(INITIAL_LIQUIDITY_A, INITIAL_LIQUIDITY_B);

      const userShares = await swapContract.liquidityShares(owner.address);
      const removeShares = userShares / 4n; // 移除四分之一

      const balanceA_before = await tokenA.balanceOf(owner.address);
      const balanceB_before = await tokenB.balanceOf(owner.address);

      const tx = await swapContract.remove_liquidity(removeShares);
      await tx.wait();

      const balanceA_after = await tokenA.balanceOf(owner.address);
      const balanceB_after = await tokenB.balanceOf(owner.address);

      expect(balanceA_after).to.be.gt(balanceA_before);
      expect(balanceB_after).to.be.gt(balanceB_before);
      expect(await swapContract.liquidityShares(owner.address)).to.equal(userShares - removeShares);

      // 检查事件
      await expect(tx).to.emit(swapContract, "LiquidityRemoved");
    });
  });

  describe("代币交换", function () {
    beforeEach(async function () {
      // 在每次交换测试前添加流动性
      await tokenA.approve(await swapContract.getAddress(), INITIAL_LIQUIDITY_A);
      await tokenB.approve(await swapContract.getAddress(), INITIAL_LIQUIDITY_B);
      await swapContract.add_liquidity(INITIAL_LIQUIDITY_A, INITIAL_LIQUIDITY_B);
    });

    it("应该能够进行 A -> B 代币交换", async function () {
      const swapAmount = ethers.parseEther("100");
      const deadline = Math.floor(Date.now() / 1000) + 300; // 5分钟后过期

      const balanceBefore = await tokenB.balanceOf(owner.address);

      await tokenA.approve(await swapContract.getAddress(), swapAmount);
      
      const tx = await swapContract.swap(
        await tokenA.getAddress(),
        swapAmount,
        0, // 最小输出为0（生产环境应设置合理滑点）
        deadline
      );
      const receipt = await tx.wait();

      const balanceAfter = await tokenB.balanceOf(owner.address);

      expect(balanceAfter).to.be.gt(balanceBefore);

      // 检查事件
      await expect(tx)
        .to.emit(swapContract, "Swapped")
        .withArgs(
          owner.address,
          await tokenA.getAddress(),
          swapAmount,
          await tokenB.getAddress(),
          balanceAfter - balanceBefore
        );
    });

    it("应该能够进行 B -> A 代币交换", async function () {
      const swapAmount = ethers.parseEther("200");
      const deadline = Math.floor(Date.now() / 1000) + 300;

      const balanceBefore = await tokenA.balanceOf(owner.address);

      await tokenB.approve(await swapContract.getAddress(), swapAmount);
      
      const tx = await swapContract.swap(
        await tokenB.getAddress(),
        swapAmount,
        0,
        deadline
      );
      await tx.wait();

      const balanceAfter = await tokenA.balanceOf(owner.address);

      expect(balanceAfter).to.be.gt(balanceBefore);

      // 检查事件
      await expect(tx).to.emit(swapContract, "Swapped");
    });

    it("应该拒绝无效代币交换", async function () {
      const invalidTokenAddress = ethers.ZeroAddress;
      const swapAmount = ethers.parseEther("100");
      const deadline = Math.floor(Date.now() / 1000) + 300;

      await expect(
        swapContract.swap(invalidTokenAddress, swapAmount, 0, deadline)
      ).to.be.revertedWith("NuaaSwap: INVALID_TOKEN");
    });

    it("应该拒绝过期的交换", async function () {
      const swapAmount = ethers.parseEther("100");
      const pastDeadline = Math.floor(Date.now() / 1000) - 300; // 5分钟前

      await tokenA.approve(await swapContract.getAddress(), swapAmount);

      await expect(
        swapContract.swap(
          await tokenA.getAddress(),
          swapAmount,
          0,
          pastDeadline
        )
      ).to.be.revertedWith("NuaaSwap: DEADLINE_EXPIRED");
    });
  });

  describe("管理功能", function () {
    it("应该能够设置协议费用", async function () {
      const newFee = 50; // 0.5%

      const tx = await swapContract.setProtocolFee(newFee);
      await tx.wait();

      expect(await swapContract.protocolFeeBps()).to.equal(newFee);

      // 检查事件
      await expect(tx).to.emit(swapContract, "ProtocolFeeSet").withArgs(0, newFee);
    });

    it("应该拒绝过高的协议费用", async function () {
      const excessiveFee = 1500; // 15% > 10% 限制

      await expect(
        swapContract.setProtocolFee(excessiveFee)
      ).to.be.revertedWith("NuaaSwap: FEE_TOO_HIGH");
    });

    it("应该能够设置费用接收地址", async function () {
      const feeReceiver = addr1.address;

      const tx = await swapContract.setFeeTo(feeReceiver);
      await tx.wait();

      expect(await swapContract.feeTo()).to.equal(feeReceiver);

      // 检查事件
      await expect(tx)
        .to.emit(swapContract, "FeeToSet")
        .withArgs(ethers.ZeroAddress, feeReceiver);
    });

    it("非所有者不应该能够设置费用", async function () {
      await expect(
        swapContract.connect(addr1).setProtocolFee(50)
      ).to.be.revertedWithCustomError(swapContract, "OwnableUnauthorizedAccount");

      await expect(
        swapContract.connect(addr1).setFeeTo(addr1.address)
      ).to.be.revertedWithCustomError(swapContract, "OwnableUnauthorizedAccount");
    });
  });

  describe("暂停功能", function () {
    it("应该能够暂停合约", async function () {
      await swapContract.pause();

      // 尝试在暂停时添加流动性（应该失败）
      await tokenA.approve(await swapContract.getAddress(), ethers.parseEther("100"));
      await tokenB.approve(await swapContract.getAddress(), ethers.parseEther("200"));

      await expect(
        swapContract.add_liquidity(ethers.parseEther("100"), ethers.parseEther("200"))
      ).to.be.revertedWithCustomError(swapContract, "EnforcedPause");
    });

    it("应该能够取消暂停合约", async function () {
      // 先暂停
      await swapContract.pause();

      // 然后取消暂停
      await swapContract.unpause();

      // 现在应该能够正常操作
      await tokenA.approve(await swapContract.getAddress(), ethers.parseEther("100"));
      await tokenB.approve(await swapContract.getAddress(), ethers.parseEther("200"));

      const tx = await swapContract.add_liquidity(ethers.parseEther("100"), ethers.parseEther("200"));
      await tx.wait();

      expect(await swapContract.totalShares()).to.be.gt(0);
    });

    it("非所有者不应该能够暂停合约", async function () {
      await expect(
        swapContract.connect(addr1).pause()
      ).to.be.revertedWithCustomError(swapContract, "OwnableUnauthorizedAccount");

      await expect(
        swapContract.connect(addr1).unpause()
      ).to.be.revertedWithCustomError(swapContract, "OwnableUnauthorizedAccount");
    });
  });

  describe("协议费用测试", function () {
    beforeEach(async function () {
      // 设置协议费用和接收地址
      await swapContract.setProtocolFee(100); // 1%
      await swapContract.setFeeTo(addr1.address);

      // 添加初始流动性
      await tokenA.approve(await swapContract.getAddress(), INITIAL_LIQUIDITY_A);
      await tokenB.approve(await swapContract.getAddress(), INITIAL_LIQUIDITY_B);
      await swapContract.add_liquidity(INITIAL_LIQUIDITY_A, INITIAL_LIQUIDITY_B);
    });

    it("应该在交换时收取协议费用", async function () {
      const swapAmount = ethers.parseEther("100");
      const deadline = Math.floor(Date.now() / 1000) + 300;

      const feeReceiverBalanceBefore = await tokenB.balanceOf(addr1.address);

      await tokenA.approve(await swapContract.getAddress(), swapAmount);
      await swapContract.swap(
        await tokenA.getAddress(),
        swapAmount,
        0,
        deadline
      );

      const feeReceiverBalanceAfter = await tokenB.balanceOf(addr1.address);

      // 费用接收者应该收到一些代币作为协议费用
      expect(feeReceiverBalanceAfter).to.be.gt(feeReceiverBalanceBefore);
    });
  });

  describe("边界条件测试", function () {
    it("应该拒绝添加零流动性", async function () {
      await expect(
        swapContract.add_liquidity(0, 0)
      ).to.be.revertedWith("NuaaSwap: INSUFFICIENT_LIQUIDITY_MINTED");
    });

    it("应该拒绝移除超过拥有的流动性份额", async function () {
      // 先添加一些流动性
      await tokenA.approve(await swapContract.getAddress(), ethers.parseEther("100"));
      await tokenB.approve(await swapContract.getAddress(), ethers.parseEther("200"));
      await swapContract.add_liquidity(ethers.parseEther("100"), ethers.parseEther("200"));

      const userShares = await swapContract.liquidityShares(owner.address);
      const excessiveShares = userShares + 1n;

      await expect(
        swapContract.remove_liquidity(excessiveShares)
      ).to.be.revertedWith("NuaaSwap: INSUFFICIENT_SHARES");
    });
  });
});
