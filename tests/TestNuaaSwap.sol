// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "remix_tests.sol"; 
import "../contracts/nuaa_swap.sol";
import "../contracts/corn_a.sol";
import "../contracts/corn_b.sol";

contract TestNuaaSwap {
    NuaaSwap swapContract;
    TokenA tokenA;
    TokenB tokenB;
    
    uint256 constant INITIAL_LIQUIDITY_A = 1000 * 10**18;
    uint256 constant INITIAL_LIQUIDITY_B = 2000 * 10**18;
    
    // Setup before tests
    function beforeAll() public {
        // Deploy token contracts
        tokenA = new TokenA();
        tokenB = new TokenB();
        
        // Deploy swap contract
        swapContract = new NuaaSwap(address(tokenA), address(tokenB));
    }
    
    // Test contract deployment
    function testContractDeployment() public {
        Assert.equal(swapContract.token0(), address(tokenA), "Token0 address should be correct");
        Assert.equal(swapContract.token1(), address(tokenB), "Token1 address should be correct");
        Assert.equal(swapContract.totalShares(), 0, "Initial liquidity shares should be 0");
        Assert.equal(swapContract.reserve0(), 0, "Initial reserve0 should be 0");
        Assert.equal(swapContract.reserve1(), 0, "Initial reserve1 should be 0");
    }
    
    // Test adding initial liquidity
    function testAddInitialLiquidity() public {
        // Approve contract to use tokens
        tokenA.approve(address(swapContract), INITIAL_LIQUIDITY_A);
        tokenB.approve(address(swapContract), INITIAL_LIQUIDITY_B);
        
        // Add liquidity
        uint shares = swapContract.add_liquidity(INITIAL_LIQUIDITY_A, INITIAL_LIQUIDITY_B);
        
        // Check results
        Assert.ok(shares > 0, "Should receive liquidity shares");
        Assert.equal(swapContract.reserve0(), INITIAL_LIQUIDITY_A, "Reserve0 should be updated");
        Assert.equal(swapContract.reserve1(), INITIAL_LIQUIDITY_B, "Reserve1 should be updated");
        Assert.equal(swapContract.liquidityShares(address(this)), shares, "Should own liquidity shares");
    }
    
    // Test adding more liquidity
    function testAddMoreLiquidity() public {
        uint256 addAmount0 = 500 * 10**18;
        uint256 addAmount1 = 1000 * 10**18;
        
        tokenA.approve(address(swapContract), addAmount0);
        tokenB.approve(address(swapContract), addAmount1);
        
        uint sharesBefore = swapContract.totalShares();
        uint shares = swapContract.add_liquidity(addAmount0, addAmount1);
        
        Assert.ok(shares > 0, "Should receive liquidity shares");
        Assert.equal(swapContract.totalShares(), sharesBefore + shares, "Total shares should increase");
    }
    
    // Test token swap A -> B
    function testSwapAtoB() public {
        uint256 swapAmount = 100 * 10**18;
        
        uint256 balanceBefore = tokenB.balanceOf(address(this));
        
        tokenA.approve(address(swapContract), swapAmount);
        
        uint256 amountOut = swapContract.swap(
            address(tokenA), 
            swapAmount, 
            0, // Min output 0 (should set reasonable slippage in production)
            block.timestamp + 300
        );
        
        uint256 balanceAfter = tokenB.balanceOf(address(this));
        
        Assert.ok(amountOut > 0, "Should receive output tokens");
        Assert.equal(balanceAfter, balanceBefore + amountOut, "Token B balance should increase");
    }
    
    // Test token swap B -> A
    function testSwapBtoA() public {
        uint256 swapAmount = 200 * 10**18;
        
        uint256 balanceBefore = tokenA.balanceOf(address(this));
        
        tokenB.approve(address(swapContract), swapAmount);
        
        uint256 amountOut = swapContract.swap(
            address(tokenB), 
            swapAmount, 
            0,
            block.timestamp + 300
        );
        
        uint256 balanceAfter = tokenA.balanceOf(address(this));
        
        Assert.ok(amountOut > 0, "Should receive output tokens");
        Assert.equal(balanceAfter, balanceBefore + amountOut, "Token A balance should increase");
    }
    
    // Test removing liquidity
    function testRemoveLiquidity() public {
        uint256 userShares = swapContract.liquidityShares(address(this));
        uint256 removeShares = userShares / 4; // Remove quarter
        
        uint256 balanceA_before = tokenA.balanceOf(address(this));
        uint256 balanceB_before = tokenB.balanceOf(address(this));
        
        (uint256 amount0, uint256 amount1) = swapContract.remove_liquidity(removeShares);
        
        uint256 balanceA_after = tokenA.balanceOf(address(this));
        uint256 balanceB_after = tokenB.balanceOf(address(this));
        
        Assert.ok(amount0 > 0, "Should receive token A");
        Assert.ok(amount1 > 0, "Should receive token B");
        Assert.equal(swapContract.liquidityShares(address(this)), userShares - removeShares, "Liquidity shares should decrease");
        Assert.equal(balanceA_after, balanceA_before + amount0, "Token A balance should increase by amount0");
        Assert.equal(balanceB_after, balanceB_before + amount1, "Token B balance should increase by amount1");
    }
    
    // Test setting protocol fee
    function testSetProtocolFee() public {
        uint256 newFee = 50; // 0.5%
        
        swapContract.setProtocolFee(newFee);
        
        Assert.equal(swapContract.protocolFeeBps(), newFee, "Protocol fee should be updated");
    }
    
    // Test setting fee receiver address
    function testSetFeeTo() public {
        address feeReceiver = address(0x123);
        swapContract.setFeeTo(feeReceiver);
        
        Assert.equal(swapContract.feeTo(), feeReceiver, "Fee receiver address should be updated");
    }
    
    // Test pause functionality
    function testPause() public {
        // Pause contract
        swapContract.pause();
        
        // Try to add liquidity when paused (should fail)
        tokenA.approve(address(swapContract), 100 * 10**18);
        tokenB.approve(address(swapContract), 200 * 10**18);
        
        try swapContract.add_liquidity(100 * 10**18, 200 * 10**18) {
            Assert.ok(false, "Should not be able to add liquidity when paused");
        } catch {
            Assert.ok(true, "Correctly rejected operation when paused");
        }
    }
    
    // Test unpause functionality
    function testUnpause() public {
        // Unpause contract
        swapContract.unpause();
        
        // Should now be able to operate normally
        tokenA.approve(address(swapContract), 100 * 10**18);
        tokenB.approve(address(swapContract), 200 * 10**18);
        
        uint shares = swapContract.add_liquidity(100 * 10**18, 200 * 10**18);
        Assert.ok(shares > 0, "Should be able to add liquidity after unpause");
    }
    
    // Test protocol fee limit
    function testProtocolFeeLimit() public {
        try swapContract.setProtocolFee(1500) { // 15% > 10% limit
            Assert.ok(false, "Should not allow setting excessive protocol fee");
        } catch {
            Assert.ok(true, "Correctly prevented excessive protocol fee setting");
        }
    }
    
    // Test invalid token swap
    function testInvalidTokenSwap() public {
        address invalidToken = address(0x999);
        
        try swapContract.swap(invalidToken, 100, 0, block.timestamp + 300) {
            Assert.ok(false, "Should not allow invalid token swap");
        } catch {
            Assert.ok(true, "Correctly prevented invalid token swap");
        }
    }
} 