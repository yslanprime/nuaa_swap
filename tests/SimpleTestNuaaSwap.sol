// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "remix_tests.sol"; 
import "../contracts/nuaa_swap.sol";
import "../contracts/corn_a.sol";
import "../contracts/corn_b.sol";

contract SimpleTestNuaaSwap {
    NuaaSwap swapContract;
    TokenA tokenA;
    TokenB tokenB;
    
    uint256 constant AMOUNT_A = 1000 * 10**18;
    uint256 constant AMOUNT_B = 2000 * 10**18;
    
    function beforeAll() public {
        tokenA = new TokenA();
        tokenB = new TokenB();
        swapContract = new NuaaSwap(address(tokenA), address(tokenB));
    }
    
    function testDeploy() public {
        Assert.equal(swapContract.token0(), address(tokenA), "Token0 should match");
        Assert.equal(swapContract.token1(), address(tokenB), "Token1 should match");
        Assert.equal(swapContract.totalShares(), 0, "Total shares should be 0");
    }
    
    function testAddLiquidity() public {
        tokenA.approve(address(swapContract), AMOUNT_A);
        tokenB.approve(address(swapContract), AMOUNT_B);
        
        uint shares = swapContract.add_liquidity(AMOUNT_A, AMOUNT_B);
        
        Assert.ok(shares > 0, "Should get shares");
        Assert.equal(swapContract.reserve0(), AMOUNT_A, "Reserve0 updated");
        Assert.equal(swapContract.reserve1(), AMOUNT_B, "Reserve1 updated");
    }
    
    function testSwap() public {
        uint256 swapAmount = 100 * 10**18;
        uint256 balanceBefore = tokenB.balanceOf(address(this));
        
        tokenA.approve(address(swapContract), swapAmount);
        uint256 amountOut = swapContract.swap(
            address(tokenA), 
            swapAmount, 
            0,
            block.timestamp + 300
        );
        
        uint256 balanceAfter = tokenB.balanceOf(address(this));
        
        Assert.ok(amountOut > 0, "Should get output");
        Assert.equal(balanceAfter, balanceBefore + amountOut, "Balance updated");
    }
    
    function testRemoveLiquidity() public {
        uint256 userShares = swapContract.liquidityShares(address(this));
        uint256 removeShares = userShares / 2;
        
        (uint256 amount0, uint256 amount1) = swapContract.remove_liquidity(removeShares);
        
        Assert.ok(amount0 > 0, "Should get token A");
        Assert.ok(amount1 > 0, "Should get token B");
    }
    
    function testSetFee() public {
        swapContract.setProtocolFee(50);
        Assert.equal(swapContract.protocolFeeBps(), 50, "Fee should be set");
    }
    
    function testPause() public {
        swapContract.pause();
        
        tokenA.approve(address(swapContract), 100 * 10**18);
        tokenB.approve(address(swapContract), 200 * 10**18);
        
        try swapContract.add_liquidity(100 * 10**18, 200 * 10**18) {
            Assert.ok(false, "Should fail when paused");
        } catch {
            Assert.ok(true, "Correctly paused");
        }
        
        swapContract.unpause();
        uint shares = swapContract.add_liquidity(100 * 10**18, 200 * 10**18);
        Assert.ok(shares > 0, "Should work after unpause");
    }
} 