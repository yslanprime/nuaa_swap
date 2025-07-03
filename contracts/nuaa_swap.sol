// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// import openzeppelin-contracts
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/access/Ownable.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/security/Pausable.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/security/ReentrancyGuard.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract NuaaSwap is Ownable, Pausable, ReentrancyGuard {
    address public immutable token0;  // fix the address of token0
    address public immutable token1; // fix the address of token1 

    uint256 public reserve0;
    uint256 public reserve1;
    
    mapping(address => uint) public liquidityShares;
    uint public totalShares;

    address public feeTo; // 协议费收取地址
    uint256 public protocolFeeBps; // (protocolFeeBps/10000)

    event LiquidityAdded(address indexed provider, uint amount0, uint amount1, uint shares);
    event LiquidityRemoved(address indexed provider, uint amount0, uint amount1);
    event Swapped(address indexed user, address indexed tokenIn, uint amountIn, address indexed tokenOut, uint amountOut);
    event FeeToSet(address indexed oldFeeTo, address indexed newFeeTo);
    event ProtocolFeeSet(uint oldFee, uint newFee);

    constructor(address _token0, address _token1) {
        token0 = _token0;
        token1 = _token1;
    }

    // make sure it is not OOT
    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, "NuaaSwap: DEADLINE_EXPIRED");
        _;
    }

    function add_liquidity(uint _amount0, uint _amount1) 
        public 
        whenNotPaused
        returns (uint shares) 
    {
        IERC20(token0).transferFrom(msg.sender, address(this), _amount0);
        IERC20(token1).transferFrom(msg.sender, address(this), _amount1);
        
        if (totalShares == 0) {
            shares = sqrt(_amount0 * _amount1);
        } else {
            uint shares0 = (_amount0 * totalShares) / reserve0;
            uint shares1 = (_amount1 * totalShares) / reserve1;
            shares = min(shares0, shares1);
        }
        require(shares > 0, "NuaaSwap: INSUFFICIENT_LIQUIDITY_MINTED");

        liquidityShares[msg.sender] += shares;
        totalShares += shares;
        
        reserve0 += _amount0;
        reserve1 += _amount1;

        emit LiquidityAdded(msg.sender, _amount0, _amount1, shares);
    }
    
    function remove_liquidity(uint _shares) 
        public
        whenNotPaused
        returns (uint amount0, uint amount1) 
    {
        require(liquidityShares[msg.sender] >= _shares, "NuaaSwap: INSUFFICIENT_SHARES");

        amount0 = (_shares * reserve0) / totalShares;
        amount1 = (_shares * reserve1) / totalShares;

        liquidityShares[msg.sender] -= _shares;
        totalShares -= _shares;
        reserve0 -= amount0;
        reserve1 -= amount1;

        IERC20(token0).transfer(msg.sender, amount0);
        IERC20(token1).transfer(msg.sender, amount1);
        
        emit LiquidityRemoved(msg.sender, amount0, amount1);
    }

    function swap(
        address _tokenIn, 
        uint _amountIn, 
        uint _minAmountOut, 
        uint _deadline    
    ) 
        public 
        whenNotPaused 
        nonReentrant // 防止重入攻击
        ensure(_deadline) // 检查是否过期
        returns (uint amountOut) 
    {
        require(_tokenIn == token0 || _tokenIn == token1, "NuaaSwap: INVALID_TOKEN");
        
        IERC20(_tokenIn).transferFrom(msg.sender, address(this), _amountIn);

        uint reserveIn = IERC20(_tokenIn).balanceOf(address(this)) - _amountIn;
        address tokenOut = (_tokenIn == token0) ? token1 : token0;
        uint reserveOut = IERC20(tokenOut).balanceOf(address(this));

        // LP %3 Fee
        uint amountInWithLpFee = _amountIn * 997;
        uint numerator = amountInWithLpFee * reserveOut;
        uint denominator = (reserveIn * 1000) + amountInWithLpFee;
        amountOut = numerator / denominator;
        
        require(amountOut >= _minAmountOut, "NuaaSwap: INSUFFICIENT_OUTPUT_AMOUNT"); // 滑点保护检查

        // Move Fee to feeTo Address
        if (feeTo != address(0) && protocolFeeBps > 0) {
            uint protocolFee = (amountOut * protocolFeeBps) / 10000;
            if (protocolFee > 0) {
                IERC20(tokenOut).transfer(feeTo, protocolFee);
                amountOut -= protocolFee;
            }
        }
        
        IERC20(tokenOut).transfer(msg.sender, amountOut);

        reserve0 = IERC20(token0).balanceOf(address(this));
        reserve1 = IERC20(token1).balanceOf(address(this));

        emit Swapped(msg.sender, _tokenIn, _amountIn, tokenOut, amountOut);
    }
    // admin function
    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
    
    function setFeeTo(address _newFeeTo) public onlyOwner {
        address oldFeeTo = feeTo;
        feeTo = _newFeeTo;
        emit FeeToSet(oldFeeTo, feeTo);
    }

    function setProtocolFee(uint256 _newFeeBps) public onlyOwner {
        require(_newFeeBps <= 1000, "NuaaSwap: FEE_TOO_HIGH"); // 最高10%
        uint oldFee = protocolFeeBps;
        protocolFeeBps = _newFeeBps;
        emit ProtocolFeeSet(oldFee, protocolFeeBps);
    }

    function min(uint x, uint y) private pure returns (uint) {
        return x < y ? x : y;
    }

    function sqrt(uint y) private pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}