// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "remix_tests.sol";
import "../contracts/nuaa_swap.sol";
import "../contracts/corn_a.sol"; // 假设您的TokenA文件名是 TokenA.sol
import "../contracts/corn_b.sol"; // 假设您的TokenB文件名是 TokenB.sol

contract NuaaSwapTest {
    TokenA tokenA;
    TokenB tokenB;
    NuaaSwap nuaaSwap;

    // 声明几个测试账户，方便模拟不同角色
    address owner;  // 合约的所有者
    address user1;  // 普通用户
    address feeCollector; // 协议费接收者

    // --- 钩子函数：在每个测试用例 (test function) 运行前都会执行一次 ---
    // 目的是为每个测试用例搭建一个全新的、干净的测试环境
    function beforeEach() public {
        // 初始化账户
        owner = address(this); // 在Remix测试中，默认调用者就是owner
        user1 = Tests.getAccount(1); // 从Remix获取第二个测试账户
        feeCollector = Tests.getAccount(2); // 获取第三个测试账户

        // 部署代币合约
        tokenA = new TokenA();
        tokenB = new TokenB();

        // 部署我们的NuaaSwap合约
        nuaaSwap = new NuaaSwap(address(tokenA), address(tokenB));

        // --- 准备工作：给user1一些代币用于测试 ---
        // owner作为代币的初始拥有者，给user1转账
        tokenA.transfer(user1, 1000 * 1e18);
        tokenB.transfer(user1, 1000 * 1e18);

        // --- 准备工作：user1授权NuaaSwap合约可以动用他的代币 ---
        // 使用vm.prank切换调用者身份，模拟user1的操作
        vm.prank(user1);
        tokenA.approve(address(nuaaSwap), 1000 * 1e18);
        vm.prank(user1);
        tokenB.approve(address(nuaaSwap), 1000 * 1e18);
    }

    // --- 测试1：基础的流动性添加与移除 ---
    function test_add_and_remove_liquidity() public {
        // 模拟user1添加流动性
        vm.prank(user1);
        uint shares = nuaaSwap.add_liquidity(100 * 1e18, 200 * 1e18);
        
        // 断言：验证储备量和份额是否正确
        Assert.equal(nuaaSwap.reserve0(), 100 * 1e18, "Reserve A should be 100");
        Assert.equal(nuaaSwap.reserve1(), 200 * 1e18, "Reserve B should be 200");
        Assert.equal(nuaaSwap.liquidityShares(user1), shares, "User1 should have correct shares");

        // 模拟user1移除全部流动性
        vm.prank(user1);
        nuaaSwap.remove_liquidity(shares);

        // 断言：验证移除后，储备量归零
        Assert.equal(nuaaSwap.reserve0(), 0, "Reserve A should be 0 after removal");
        Assert.equal(nuaaSwap.reserve1(), 0, "Reserve B should be 0 after removal");
    }

    // --- 测试2：测试交易因为“时限已过(Deadline)”而失败 ---
    function test_revert_on_expired_deadline() public {
        // 先添加一些流动性
        vm.prank(user1);
        nuaaSwap.add_liquidity(500 * 1e18, 500 * 1e18);

        // 设置一个已经过去的时间戳作为deadline
        uint past_deadline = block.timestamp - 1; 

        // 尝试用这个过期的deadline去swap
        try nuaaSwap.swap(address(tokenA), 10 * 1e18, 1 * 1e18, past_deadline) {
            // 如果代码能执行到这里，说明交易没失败，这不符合预期，所以测试失败
            Assert.isTrue(false, "Swap should have reverted due to expired deadline");
        } catch Error(string memory reason) {
            // 交易如预期般失败了，我们检查失败的原因是否是"DEADLINE_EXPIRED"
            Assert.equal(reason, "NuaaSwap: DEADLINE_EXPIRED", "Revert reason should be deadline expired");
        }
    }

    // --- 测试3：测试只有owner才能暂停合约 ---
    function test_revert_when_non_owner_pauses() public {
        // 模拟user1（非owner）尝试调用pause函数
        vm.prank(user1);
        try nuaaSwap.pause() {
            Assert.isTrue(false, "Non-owner should not be able to pause");
        } catch {
            // 成功捕获到错误，说明权限控制生效，测试通过
            Assert.isTrue(true, "Successfully reverted for non-owner pause attempt");
        }
    }

    // --- 测试4：测试协议手续费能被成功收取 ---
    function test_protocol_fee_is_collected() public {
        // 1. owner先设置手续费接收地址和费率 (5%)
        nuaaSwap.setFeeTo(feeCollector);
        nuaaSwap.setProtocolFee(500); // 500 BPS = 5%

        // 2. user1添加流动性
        vm.prank(user1);
        nuaaSwap.add_liquidity(1000 * 1e18, 1000 * 1e18);

        // 3. owner给自己的账户也准备一些A代币用于swap
        tokenA.transfer(owner, 100 * 1e18);
        tokenA.approve(address(nuaaSwap), 100 * 1e18);

        // 4. owner执行一次swap
        uint deadline = block.timestamp + 15;
        nuaaSwap.swap(address(tokenA), 100 * 1e18, 1 * 1e18, deadline);
        
        // 5. 验证：检查feeCollector的TokenB余额是否大于0
        // 这证明了在swap过程中，有一部分TokenB作为协议费被发送给了它
        uint feeCollectorBalance = tokenB.balanceOf(feeCollector);
        Assert.isTrue(feeCollectorBalance > 0, "Fee collector should have received protocol fees");
        
        // 也可以验证owner收到的TokenB数量会比没有协议费时少一点
    }
}