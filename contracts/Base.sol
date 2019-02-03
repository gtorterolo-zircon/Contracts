pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./fixidity/FixidityLib.sol";

/**
 * @title Base contract.
 */
contract Base {
    using SafeMath for uint256;

    /**
     * @dev Scaling factor for the calculation of fees, expressed in fixed 
     * point units.
     * Test scalingFactor = FixidityLib.fixed_1()
     */
    int256 constant public scalingFactor = 1000000000000000000000000000000000000;

    /**
     * @dev Minimum that can be returned when calculating a fee, expressed in
     * fixed point units.
     * Test minimumFee = FixidityLib.fixed_1()/(10**6)
     */
    int256 constant public minimumFee = 1000000000000000000000000000000;

    /**
     * @dev (C1) Whitelist of addresses that can do governance.
     */
    mapping(address => bool) internal governors;

    struct TokenData {
        /**
         * @dev (C2, C3) This is list of stablecoins that can be stored in the basket,
         * only if their proportion is set to > 0.
         */
        bool approved;
        /**
         * @dev (C20) The decimals supported by the token. Given that this is
         * not a ERC20 standard they must be entered manually.
         */
        uint8 decimals;        
        /**
         * @dev (C4) The proportion of each token we want in the basket
         * using fixed point units in a 0 to FixidityLib.fixed_1() range.
         * ToDo: Change so that it can be sanity-checked that all proportions add
         * up to FixidityLib.fixed_1(). Otherwise we will have to do a costly 
         * conversion with each fee calculation.
         */
        int256 targetProportion;
        /**
         * @dev (C20) The base deposit fees for each token in the basket using 
         * fixidity units in a FixidityLib.fixed_1()/1000000 to 
         * FixidityLib.max_fixed_mul() range.
         */
        int256 depositFee;
    }

    mapping(address => TokenData) internal tokens;
    /**
     * Since it's not possible to iterate over a mapping, it's necessary
     * to have an array, so we can iterate over it and verify all the
     * information on the mapping.
     */
    address[] internal tokensList;

    /**
     * @dev (C13) As a Stablecoin Holder, I would like to be able to pay any
     * fees with any of the stablecoins on the basket list
     */
    mapping(address => address) internal payFeesWith;

    /**
     * @dev This is one of the possible solutions allowing to check
     * if an address is an implementation of an interface.
     * See https://stackoverflow.com/questions/45364197
     */
    modifier isCompliantToken(address _token) {
        uint size;
        // See https://stackoverflow.com/a/40939341 to understand the following test.
        // Make sure to never use this test alone, as it can yeld fake positives when
        // inverted. It *must* be used in conjunction of other tests, eg methods existence.
        // solium-disable-next-line security/no-inline-assembly
        assembly { size := extcodesize(_token) }
        require(
            size > 0, "The specified address doesn't look like a deployed contract."
        );

        require(
            IERC20(_token).balanceOf(_token) >= 0 &&
            IERC20(_token).totalSupply() >= 0,
            "The provided address doesn't look like a valid ERC20 implementation."
        );
        _;
    }

    /**
     * @dev In order to make the code easier to read
     * this method is only a group of requires
     */
    modifier isAcceptedToken(address _token) {
        TokenData memory token = tokens[_token];
        require(
            token.approved == true,
            "The given token isn't listed as accepted."
        );
        require(
            token.targetProportion > 0,
            "The given token is accepted but doesn't have a target proportion."
        );
        require(
            token.decimals > 0,
            "The given token is accepted but its number of decimals hasn't been provided."
        );
        _;
    }

    /**
     * @dev Returns an address array of approved tokens, and it's size
     */
    function getApprovedTokens() 
        public 
        view 
        returns(address[] memory, uint256) 
    {
        uint256 totalAddresses = tokensList.length;
        uint256 activeIndex = 0;
        address[] memory activeAddresses = new address[](totalAddresses);
        for (uint256 totalIndex = 0; totalIndex < totalAddresses; totalIndex += 1) {
            TokenData memory token = tokens[tokensList[totalIndex]];
            if (token.approved == true) {
                activeAddresses[activeIndex] = tokensList[totalIndex];
                activeIndex += 1; // Unlikely to overflow
            }
        }
        return (activeAddresses, activeIndex);
    }

    /**
     * @dev (C20) Converts a token amount to the decimal representation
     * used in the basket.
     */
    function convertBalance(address _token, uint256 _amount)
        public
        view
        returns (int256)
    {
        uint8 decimalDifference;
        uint8 tokenDecimals;
        int256 amount;

        tokenDecimals = tokens[_token].decimals;
        assert(tokenDecimals <= 38);
        if ( tokenDecimals < FixidityLib.digits() ){
            decimalDifference = FixidityLib.digits() - tokenDecimals;
            // Cast uint8 -> uint128 is safe
            // Exponentiation is safe:
            //     Token.decimals limited to 38 or less
            //     decimalDifference = abs(FixidityLib.digits() - token.decimals)
            //     decimalDifference < 38
            //     10**38 < 2**128-1
            amount = safeCast(
                _amount*(uint128(10)**uint128(decimalDifference))
            );
        }
        else if ( tokenDecimals > FixidityLib.digits() ){
            decimalDifference = tokenDecimals - FixidityLib.digits();
            amount = safeCast(
                _amount/(uint128(10)**uint128(decimalDifference))
            );
        }
        // If tokenDecimals == FixidityLib.digits() no conversion is required

        return amount;
    } 

    /**
     * @dev (C20) Returns the balance of a token in the decimal representation
     * used in the basket.
     */
    function standardizedBalance(address _token)
        public
        view
        returns (int256)
    {
        return convertBalance(_token, IERC20(_token).balanceOf(address(this)));
    }

    /**
     * @dev (C20) Returns the total amount of tokens in the basket. Tokens 
     * always use a kind of fixed point representation were a whole token 
     * equals a value of something like 10**18 in the balance, with a uint8
     * decimals member. This function finds the difference in decimals between
     * the fixed point library and the token definition and multiplies or 
     * divides accordingly to be able to aggregate the balances of all the
     * tokens to the same fixed point standard.
     * TODO: Make sure that no redemptions are accepted for a token if this would
     * bring its balance in the basket below 0.
     * Make token x to have 18 decimals and y 20 decimals
     * Test basketBalance() = 0 before introducing any tokens.
     * Test basketBalance() = fixed_1() after introducing 1 token of x type
     * Test basketBalance() = 2*fixed_1() after introducing 1 token of x type
     * Test basketBalance() = 3*fixed_1() after introducing 1 token of y type
     * Test basketBalance() = 13*fixed_1() after introducing 10 token of y type
     * Test basketBalance() = 2*fixed_1() after removing 11 token of y type
     */
    function basketBalance()
        public
        view
        returns (int256)
    {
        int256 balance = 0;
        uint256 totalTokens;
        address[] memory tokensInBasket;

        (tokensInBasket, totalTokens) = getApprovedTokens();

        for ( uint256 i = 0; i < totalTokens; i += 1 )
        {
            balance = FixidityLib.add(balance, standardizedBalance(tokensInBasket[i]));
        }
        assert(balance >= 0);
        return balance;
    }

    /**
     * @dev (C20) Cast safely from uint256 (token balances) to int256 (proportions and fees)
     */
    function safeCast(uint256 x) 
        public 
        pure 
        returns(int256)
    {
        assert(x >= 0);
        assert(x <= 57896044618658097711785492504343953926634992332820282019728792003956564819967); 
        return int256(x);
    } 
}
