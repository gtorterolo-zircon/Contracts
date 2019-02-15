pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./fixidity/FixidityLib.sol";
import "./Utils.sol";

/**
 * @title Base MIXR contract. 
 * @author Alberto Cuesta Canada, Bernardo Vieira
 * @notice Implements a basket of stablecoins as an ERC20 token, as described
 * in the CementDAO whitepaper.
 */
contract Base {
    using SafeMath for uint256;

    /**
     * @notice Scaling factor for the calculation of fees, expressed in fixed 
     * point units.
     * @dev Test scalingFactor = FixidityLib.fixed1()/2
     */
    int256 constant public scalingFactor = 500000000000000000000000000000000000;

    /**
     * @notice Minimum that can be returned when calculating a fee, expressed in
     * MIX wei.
     */
    uint256 constant public minimumFee = 1000000000000000000;

    /**
     * @notice (C1) Whitelist of addresses that can do governance.
     */
    mapping(address => bool) internal governors;

    /**
     * @notice Additional token data which is required for MIXR transactions.
     */
    struct TokenData {
        /**
         * @notice Whether a stablecoin has been approved for transactions with
         * the basket.
         */
        bool approved;
        /**
         * @notice The proportion of this token that we want in the basket. 
         * It uses fixed point units in a 0 to FixidityLib.fixed1() range. 
         * If it is set to 0 no deposits are accepted for it.
         */
        int256 targetProportion;
        /**
         * @notice The base deposit fees in MIX wei for this token.
         */
        uint256 depositFee;
        /**
         * @notice The base redemption fees in MIX wei for this token.
         */
        uint256 redemptionFee;
        /**
         * @notice The base transfer fees in MIX wei for this token.
         */
        uint256 transferFee;
    }

    /**
     * @notice Mapping of tokens either candidates for or in the basket.
     */
    mapping(address => TokenData) internal tokens;
    /**
     * @dev Since it's not possible to iterate over a mapping, it's necessary
     * to have an array to iterate over it and verify all the entries.
     */
    address[] internal tokensList;

    /**
     * @notice (C13) As a Stablecoin Holder, I would like to be able to pay any
     * fees with any of the stablecoins on the basket list
     */
    // mapping(address => address) internal payFeesWith;
    
    /**
     * @notice Holding account for fees, before they are distributed to stakeholders.
     */
    address internal stakeholderAccount;

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
     * @notice Modifier to ensure a token is accepted for transactions.
     * @dev In order to make the code easier to read this method is only a 
     * group of requires
     */
    modifier isAcceptedToken(address _token) {
        TokenData memory token = tokens[_token];
        require(
            token.approved == true,
            "The given token isn't listed as accepted."
        );
        require(
            token.targetProportion > 0,
            "The given token can't be accepted, the target proportion is 0."
        );
        require(
            token.depositFee >= minimumFee,
            "The given token can't accepted, the base deposit fee is too low."
        );
        require(
            token.redemptionFee >= minimumFee,
            "The given token can't accepted, the base redemption fee is too low."
        );
        _;
    }

    /**
     * @notice Returns an address array of approved tokens, and its size
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
            if (token.approved) {
                activeAddresses[activeIndex] = tokensList[totalIndex];
                activeIndex += 1; // Unlikely to overflow
            }
        }
        return (activeAddresses, activeIndex);
    }

    /**
     * @notice Converts a token amount from the precision of _originToken
     * to that of _destinationToken. Use the address of the MIXR contract to
     * convert to and from MIX.
     * @dev Test:
     * Create a token x with 18 decimals and a token y with 20 decimals
     * Test convertTokensAmount(x, y, 1) = 100
     * Test convertTokensAmount(y, x, 100) = 1
     * Test convertTokensAmount(y, x, 110) = 1
     */
    function convertTokensAmount(
        address _originToken, 
        address _destinationToken, 
        uint256 _amount
    )
        public
        view
        returns (uint256)
    {
        uint8 originTokenDecimals;
        uint8 destinationTokenDecimals;

        if ( _originToken == address(this)) {
            originTokenDecimals = ERC20Detailed(address(this)).decimals();
        }
        else {
            // assert(tokens.contains(_originToken))
            originTokenDecimals = ERC20Detailed(_originToken).decimals();
        }

        if ( _destinationToken == address(this)) {
            destinationTokenDecimals = ERC20Detailed(address(this)).decimals();
        }
        else {
            // assert(tokens.contains(_destinationToken))
            destinationTokenDecimals = ERC20Detailed(_destinationToken).decimals();
        }

        int256 convertedAmount = FixidityLib.convertFixed(
            Utils.safeCast(_amount), 
            originTokenDecimals, 
            destinationTokenDecimals
        );
        assert(convertedAmount >= 0);
        return uint256(convertedAmount);
    } 

    /**
     * @notice Returns the _originToken balance in the precision of
     * _destinationToken. Use the address of the MIXR contract to
     * convert to and from MIX.
     * @dev Test:
     * Create a token x with 18 decimals and a token y with 20 decimals
     * Mint 1 wei for x and 100 wei for y
     * Test convertTokens(x, y) = 100
     * Test convertTokens(y, x) = 1
     */
    function convertTokens(
        address _originToken, 
        address _destinationToken
    )
        public
        view
        returns (uint256)
    {
        return convertTokensAmount(
            _originToken, 
            _destinationToken, 
            IERC20(_originToken).balanceOf(address(this)));
    }

    /**
     * @notice Returns the total amount of tokens in the basket. Tokens 
     * always use a kind of fixed point representation were a whole token 
     * equals a value of something like 10**18 in the balance, with a uint8
     * decimals member. This function finds the difference in decimals between
     * the fixed point library and the token definition and multiplies or 
     * divides accordingly to be able to aggregate the balances of all the
     * tokens to the same fixed point standard. 
     * @dev 
     * In MIXR it should be identical to IERC20(address(this)).totalSupply()
     * Make token x to have 18 decimals and y 20 decimals
     * Make sure the MIX basket is constructed with 24 decimals
     * Test basketBalance() = 0 before introducing any tokens.
     * Test basketBalance() = (10**24) after introducing 1 token of x type
     * Test basketBalance() = 2*(10**24) after introducing 1 token of x type
     * Test basketBalance() = 3*(10**24) after introducing 1 token of y type
     * Test basketBalance() = 2*(10**24) after removing 1 token of y type
     * Remove 2 tokens of x, we have an empty basket
     * Test basketBalance() = (10**6) after introducing 1 wei of x type
     * Test basketBalance() = (10**6)+(10**4) after introducing 1 token of y type
     */
    function basketBalance()
        public
        view
        returns (uint256)
    {
        int256 balance = 0;
        uint256 totalTokens;
        address[] memory tokensInBasket;

        (tokensInBasket, totalTokens) = getApprovedTokens();

        for ( uint256 i = 0; i < totalTokens; i += 1 )
        {
            balance = FixidityLib.add(
                balance, 
                FixidityLib.newFixed(
                    // convertTokens below returns the balance in the basket decimals
                    Utils.safeCast(convertTokens(tokensInBasket[i], address(this))), 
                    // We create a new fixed point number from basket decimals to the
                    // library precision to be able to use the add function
                    ERC20Detailed(address(this)).decimals()
                )
            );
        }
        assert(balance >= 0);
        // We convert back from library precision to basket precision and to uint
        return uint256(FixidityLib.fromFixed(balance, ERC20Detailed(address(this)).decimals()));
    } 
}
