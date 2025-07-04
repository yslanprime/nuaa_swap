// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/nuaa_swap.sol";
import "../contracts/corn_a.sol";
import "../contracts/corn_b.sol";

/**
 * @title ManualTestNuaaSwap
 * @dev 手动测试合约 - 用于在 Remix 中交互式测试 NuaaSwap 功能
 * 
 * 使用说明：
 * 1. 部署此合约
 * 2. 调用 setup() 初始化
 * 3. 按顺序测试各个功能
 */
contract ManualTestNuaaSwap {
    NuaaSwap public swapContract;
    TokenA public tokenA;
    TokenB public tokenB;
    
    address public owner;
    bool public isSetup = false;
    
    // 事件用于记录测试结果
    event TestResult(string testName, bool success, string message);
    event ContractInfo(string info, address contractAddress);
    
    modifier onlyAfterSetup() {
        require(isSetup, "请先调用 setup() 函数");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev 步骤1: 设置测试环境
     */
    function setup() public {
        require(!isSetup, "已经初始化过了");
        
        // 部署代币合约
        tokenA = new TokenA();
        tokenB = new TokenB();
        
        // 部署交换合约
        swapContract = new NuaaSwap(address(tokenA), address(tokenB));
        
        isSetup = true;
        
        emit ContractInfo("TokenA 部署完成", address(tokenA));
        emit ContractInfo("TokenB 部署完成", address(tokenB));
        emit ContractInfo("NuaaSwap 部署完成", address(swapContract));
        emit TestResult("setup", true, "测试环境初始化成功");
    }
    
    /**
     * @dev 步骤2: 添加初始流动性
     */
    function addInitialLiquidity() public onlyAfterSetup {
        uint256 amountA = 1000 * 10**18;
        uint256 amountB = 2000 * 10**18;
        
        // 授权
        tokenA.approve(address(swapContract), amountA);
        tokenB.approve(address(swapContract), amountB);
        
        // 添加流动性
        uint256 shares = swapContract.add_liquidity(amountA, amountB);
        
        emit TestResult("addInitialLiquidity", shares > 0, 
            string(abi.encodePacked("获得流动性份额: ", uint2str(shares))));
    }
    
    /**
     * @dev 步骤3: 测试 A -> B 交换
     */
    function testSwapAtoB(uint256 swapAmount) public onlyAfterSetup {
        require(swapAmount > 0, "交换数量必须大于0");
        
        uint256 balanceBefore = tokenB.balanceOf(address(this));
        
        // 授权和交换
        tokenA.approve(address(swapContract), swapAmount);
        uint256 amountOut = swapContract.swap(
            address(tokenA), 
            swapAmount, 
            0,
            block.timestamp + 300
        );
        
        uint256 balanceAfter = tokenB.balanceOf(address(this));
        
        emit TestResult("swapAtoB", amountOut > 0,
            string(abi.encodePacked("输入 A: ", uint2str(swapAmount), ", 获得 B: ", uint2str(amountOut))));
    }
    
    /**
     * @dev 步骤4: 测试 B -> A 交换
     */
    function testSwapBtoA(uint256 swapAmount) public onlyAfterSetup {
        require(swapAmount > 0, "交换数量必须大于0");
        
        uint256 balanceBefore = tokenA.balanceOf(address(this));
        
        // 授权和交换
        tokenB.approve(address(swapContract), swapAmount);
        uint256 amountOut = swapContract.swap(
            address(tokenB), 
            swapAmount, 
            0,
            block.timestamp + 300
        );
        
        uint256 balanceAfter = tokenA.balanceOf(address(this));
        
        emit TestResult("swapBtoA", amountOut > 0,
            string(abi.encodePacked("输入 B: ", uint2str(swapAmount), ", 获得 A: ", uint2str(amountOut))));
    }
    
    /**
     * @dev 步骤5: 测试移除流动性
     */
    function testRemoveLiquidity(uint256 sharesToRemove) public onlyAfterSetup {
        require(sharesToRemove > 0, "移除份额必须大于0");
        
        uint256 userShares = swapContract.liquidityShares(address(this));
        require(sharesToRemove <= userShares, "移除份额超过拥有量");
        
        (uint256 amount0, uint256 amount1) = swapContract.remove_liquidity(sharesToRemove);
        
        emit TestResult("removeLiquidity", amount0 > 0 && amount1 > 0,
            string(abi.encodePacked("移除份额: ", uint2str(sharesToRemove), 
                                    ", 获得 A: ", uint2str(amount0), 
                                    ", 获得 B: ", uint2str(amount1))));
    }
    
    /**
     * @dev 步骤6: 测试暂停功能
     */
    function testPause() public onlyAfterSetup {
        require(msg.sender == owner, "只有所有者可以暂停");
        
        swapContract.pause();
        
        emit TestResult("pause", true, "合约已暂停");
    }
    
    /**
     * @dev 步骤7: 测试恢复功能
     */
    function testUnpause() public onlyAfterSetup {
        require(msg.sender == owner, "只有所有者可以恢复");
        
        swapContract.unpause();
        
        emit TestResult("unpause", true, "合约已恢复");
    }
    
    /**
     * @dev 步骤8: 测试设置协议费用
     */
    function testSetProtocolFee(uint256 feeBps) public onlyAfterSetup {
        require(msg.sender == owner, "只有所有者可以设置费用");
        
        swapContract.setProtocolFee(feeBps);
        
        emit TestResult("setProtocolFee", true,
            string(abi.encodePacked("协议费用设置为: ", uint2str(feeBps), " bps")));
    }
    
    /**
     * @dev 步骤9: 测试设置费用接收地址
     */
    function testSetFeeTo(address feeReceiver) public onlyAfterSetup {
        require(msg.sender == owner, "只有所有者可以设置费用接收地址");
        
        swapContract.setFeeTo(feeReceiver);
        
        emit TestResult("setFeeTo", true, "费用接收地址已设置");
    }
    
    // ============ 查询函数 ============
    
    /**
     * @dev 获取合约状态信息
     */
    function getContractInfo() public view onlyAfterSetup returns (
        address tokenAAddr,
        address tokenBAddr,
        address swapAddr,
        uint256 reserve0,
        uint256 reserve1,
        uint256 totalShares,
        uint256 userShares,
        uint256 protocolFee,
        address feeTo
    ) {
        return (
            address(tokenA),
            address(tokenB),
            address(swapContract),
            swapContract.reserve0(),
            swapContract.reserve1(),
            swapContract.totalShares(),
            swapContract.liquidityShares(address(this)),
            swapContract.protocolFeeBps(),
            swapContract.feeTo()
        );
    }
    
    /**
     * @dev 获取用户代币余额
     */
    function getUserBalances() public view onlyAfterSetup returns (
        uint256 balanceA,
        uint256 balanceB
    ) {
        return (
            tokenA.balanceOf(address(this)),
            tokenB.balanceOf(address(this))
        );
    }
    
    /**
     * @dev 预估交换输出
     */
    function estimateSwapOutput(address tokenIn, uint256 amountIn) public view onlyAfterSetup returns (uint256) {
        require(tokenIn == address(tokenA) || tokenIn == address(tokenB), "无效的输入代币");
        
        uint256 reserveIn = (tokenIn == address(tokenA)) ? swapContract.reserve0() : swapContract.reserve1();
        uint256 reserveOut = (tokenIn == address(tokenA)) ? swapContract.reserve1() : swapContract.reserve0();
        
        // 计算输出（考虑 0.3% 手续费）
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        
        return numerator / denominator;
    }
    
    // ============ 工具函数 ============
    
    /**
     * @dev 将 uint256 转换为字符串
     */
    function uint2str(uint256 _i) internal pure returns (string memory str) {
        if (_i == 0) {
            return "0";
        }
        
        uint256 j = _i;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        j = _i;
        while (j != 0) {
            bstr[--k] = bytes1(uint8(48 + j % 10));
            j /= 10;
        }
        
        str = string(bstr);
    }
    
    /**
     * @dev 紧急提取代币（仅所有者）
     */
    function emergencyWithdraw() public {
        require(msg.sender == owner, "只有所有者可以紧急提取");
        
        if (isSetup) {
            uint256 balanceA = tokenA.balanceOf(address(this));
            uint256 balanceB = tokenB.balanceOf(address(this));
            
            if (balanceA > 0) tokenA.transfer(owner, balanceA);
            if (balanceB > 0) tokenB.transfer(owner, balanceB);
        }
    }
} 