// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/nuaa_swap.sol";
import "../contracts/corn_a.sol";
import "../contracts/corn_b.sol";

/**
 * @title ManualTestNuaaSwap
 * @dev Manual test contract for interactive testing of NuaaSwap functions in Remix
 * 
 * Usage instructions:
 * 1. Deploy this contract
 * 2. Call setup() to initialize
 * 3. Test functions in order
 */
contract ManualTestNuaaSwap {
    NuaaSwap public swapContract;
    TokenA public tokenA;
    TokenB public tokenB;
    
    address public owner;
    bool public isSetup = false;
    
    // Events for recording test results
    event TestResult(string testName, bool success, string message);
    event ContractInfo(string info, address contractAddress);
    
    modifier onlyAfterSetup() {
        require(isSetup, "Please call setup() function first");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Step 1: Setup test environment
     */
    function setup() public {
        require(!isSetup, "Already initialized");
        
        // Deploy token contracts
        tokenA = new TokenA();
        tokenB = new TokenB();
        
        // Deploy swap contract
        swapContract = new NuaaSwap(address(tokenA), address(tokenB));
        
        isSetup = true;
        
        emit ContractInfo("TokenA deployed", address(tokenA));
        emit ContractInfo("TokenB deployed", address(tokenB));
        emit ContractInfo("NuaaSwap deployed", address(swapContract));
        emit TestResult("setup", true, "Test environment initialized successfully");
    }
    
    /**
     * @dev Step 2: Add initial liquidity
     */
    function addInitialLiquidity() public onlyAfterSetup {
        uint256 amountA = 1000 * 10**18;
        uint256 amountB = 2000 * 10**18;
        
        // Approve
        tokenA.approve(address(swapContract), amountA);
        tokenB.approve(address(swapContract), amountB);
        
        // Add liquidity
        uint256 shares = swapContract.add_liquidity(amountA, amountB);
        
        emit TestResult("addInitialLiquidity", shares > 0, 
            string(abi.encodePacked("Received liquidity shares: ", uint2str(shares))));
    }
    
    /**
     * @dev Step 3: Test A -> B swap
     */
    function testSwapAtoB(uint256 swapAmount) public onlyAfterSetup {
        require(swapAmount > 0, "Swap amount must be greater than 0");
        
        uint256 balanceBefore = tokenB.balanceOf(address(this));
        
        // Approve and swap
        tokenA.approve(address(swapContract), swapAmount);
        uint256 amountOut = swapContract.swap(
            address(tokenA), 
            swapAmount, 
            0,
            block.timestamp + 300
        );
        
        uint256 balanceAfter = tokenB.balanceOf(address(this));
        
        // Calculate actual received amount for debugging
        uint256 actualReceived = balanceAfter - balanceBefore;
        
        emit TestResult("swapAtoB", amountOut > 0,
            string(abi.encodePacked(
                "Input A: ", uint2str(swapAmount), 
                ", Expected B: ", uint2str(amountOut),
                ", Actual B: ", uint2str(actualReceived),
                ", Balance Before: ", uint2str(balanceBefore),
                ", Balance After: ", uint2str(balanceAfter)
            )));
    }
    
    /**
     * @dev Step 4: Test B -> A swap
     */
    function testSwapBtoA(uint256 swapAmount) public onlyAfterSetup {
        require(swapAmount > 0, "Swap amount must be greater than 0");
        
        uint256 balanceBefore = tokenA.balanceOf(address(this));
        
        // Approve and swap
        tokenB.approve(address(swapContract), swapAmount);
        uint256 amountOut = swapContract.swap(
            address(tokenB), 
            swapAmount, 
            0,
            block.timestamp + 300
        );
        
        uint256 balanceAfter = tokenA.balanceOf(address(this));
        
        // Calculate actual received amount for debugging
        uint256 actualReceived = balanceAfter - balanceBefore;
        
        emit TestResult("swapBtoA", amountOut > 0,
            string(abi.encodePacked(
                "Input B: ", uint2str(swapAmount), 
                ", Expected A: ", uint2str(amountOut),
                ", Actual A: ", uint2str(actualReceived),
                ", Balance Before: ", uint2str(balanceBefore),
                ", Balance After: ", uint2str(balanceAfter)
            )));
    }
    
    /**
     * @dev Step 5: Test remove liquidity
     */
    function testRemoveLiquidity(uint256 sharesToRemove) public onlyAfterSetup {
        require(sharesToRemove > 0, "Shares to remove must be greater than 0");
        
        uint256 userShares = swapContract.liquidityShares(address(this));
        require(sharesToRemove <= userShares, "Shares to remove exceed owned amount");
        
        (uint256 amount0, uint256 amount1) = swapContract.remove_liquidity(sharesToRemove);
        
        emit TestResult("removeLiquidity", amount0 > 0 && amount1 > 0,
            string(abi.encodePacked("Removed shares: ", uint2str(sharesToRemove), 
                                    ", Got A: ", uint2str(amount0), 
                                    ", Got B: ", uint2str(amount1))));
    }
    
    /**
     * @dev Step 6: Test pause function
     */
    function testPause() public onlyAfterSetup {
        require(msg.sender == owner, "Only owner can pause");
        
        swapContract.pause();
        
        emit TestResult("pause", true, "Contract paused");
    }
    
    /**
     * @dev Step 7: Test unpause function
     */
    function testUnpause() public onlyAfterSetup {
        require(msg.sender == owner, "Only owner can unpause");
        
        swapContract.unpause();
        
        emit TestResult("unpause", true, "Contract unpaused");
    }
    
    /**
     * @dev Step 8: Test set protocol fee
     */
    function testSetProtocolFee(uint256 feeBps) public onlyAfterSetup {
        require(msg.sender == owner, "Only owner can set fee");
        
        swapContract.setProtocolFee(feeBps);
        
        emit TestResult("setProtocolFee", true,
            string(abi.encodePacked("Protocol fee set to: ", uint2str(feeBps), " bps")));
    }
    
    /**
     * @dev Step 9: Test set fee receiver address
     */
    function testSetFeeTo(address feeReceiver) public onlyAfterSetup {
        require(msg.sender == owner, "Only owner can set fee receiver");
        
        swapContract.setFeeTo(feeReceiver);
        
        emit TestResult("setFeeTo", true, "Fee receiver address set");
    }
    
    // ============ Query Functions ============
    
    /**
     * @dev Get contract status info
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
     * @dev Get user token balances
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
     * @dev Estimate swap output
     */
    function estimateSwapOutput(address tokenIn, uint256 amountIn) public view onlyAfterSetup returns (uint256) {
        require(tokenIn == address(tokenA) || tokenIn == address(tokenB), "Invalid input token");
        
        uint256 reserveIn = (tokenIn == address(tokenA)) ? swapContract.reserve0() : swapContract.reserve1();
        uint256 reserveOut = (tokenIn == address(tokenA)) ? swapContract.reserve1() : swapContract.reserve0();
        
        // Calculate output (considering 0.3% fee)
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        
        return numerator / denominator;
    }
    
    // ============ Utility Functions ============
    
    /**
     * @dev Convert uint256 to string
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
     * @dev Emergency withdraw tokens (owner only)
     */
    function emergencyWithdraw() public {
        require(msg.sender == owner, "Only owner can emergency withdraw");
        
        if (isSetup) {
            uint256 balanceA = tokenA.balanceOf(address(this));
            uint256 balanceB = tokenB.balanceOf(address(this));
            
            if (balanceA > 0) tokenA.transfer(owner, balanceA);
            if (balanceB > 0) tokenB.transfer(owner, balanceB);
        }
    }
} 