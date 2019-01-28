pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./fixidity/FixidityLib.sol";
import "./fixidity/LogarithmLib.sol";
import "./Fees.sol";
import "./AddressSetLib.sol";


/**
 * @title MIXR contract.
 * @dev MIXR is an ERC20 token which is created as a basket of tokens.
 * This means that in addition to the usual ERC20 features the MIXR token
 * can react to transfers of tokens other than itself.
 * TODO: Change all hardcoded "36" to a constant.
 */
contract MIXR is ERC20, ERC20Detailed, Ownable, Fees {

    /**
     * @dev Constructor with the details of the ERC20 and initialization of the
     * floating-point Fixidity lib with 36 digits.
     */
    constructor() public ERC20Detailed("MIX", "MIX", 18) {
        fixidity.init(36);
    }

    /**
     * @dev Modifier that enforces that the transaction sender is
     * whitelisted to perform governance.
     */
    modifier onlyGovernor() {
        require(
            governors.contains(msg.sender),
            "Message sender isn't part of the governance whitelist."
        );
        _;
    }

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
        require(
            approvedTokens.contains(_token),
            "The given token isn't listed as accepted."
        );
        require(
            proportions[_token] > 0,
            "The given token is accepted but doesn't have a target proportion."
        );
        _;
    }

    /**
     * @dev Add new user to governors
     * @param _userAddress The user address to be added.
     */
    function addGovernor(address _userAddress)
        public
        onlyOwner
    {
        governors.insert(_userAddress);
    }

    /**
     * @dev Allows to query whether or not a given address is a governor.
     * @param _userAddress The address to be checked.
     * @return true if the provided user is a governor, false otherwise.
     */
    function isGovernor(address _userAddress)
    public
    view
    returns (bool) {
        return governors.contains(_userAddress);
    }

    /**
     * @dev Remove user from governors
     * @param _userAddress the user address to remove
     */
    function removeGovernor(address _userAddress)
        public
        onlyOwner
    {
        governors.remove(_userAddress);
    }

    /**
     * @dev (C11) This function allows to deposit an accepted ERC20 token
     * in exchange for some MIXR tokens.
     * It consists of several transactions that must be authorized by
     * the user prior to calling this function (See ERC20 transferFrom spec).
     */
    function depositToken(address _token, uint256 _amount)
        public
        isAcceptedToken(_token)
    {
        _mint(address(this), _amount);
        IERC20(address(this)).approve(address(this), _amount);
        // Receive the token that was sent
        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        // Send an equal number of MIXR tokens back
        IERC20(address(this)).transferFrom(address(this), msg.sender, _amount);
    }

    /**
     * @dev (C12) This function allows to deposit to the MIXR basket
     * an amount ERC20 token in the list, and returns a MIXR token in exchange.
     * 
     * Alberto: I would suggest that if the redeemer wants to receive
     * several different tokens that is managed from the frontend as
     * several consecutive but separate transactions.
     */
    function redeemMIXR(address _token, uint256 _amount)
        public
        isAcceptedToken(_token)
    {
        IERC20(_token).approve(address(this), _amount);
        // Receive the MIXR token that was sent
        IERC20(address(this)).transferFrom(msg.sender, address(this), _amount);
        // Send an equal number of selected tokens back
        IERC20(_token).transferFrom(address(this), msg.sender, _amount);
        _burn(address(this), _amount);
    }

    /**
     * @dev (C3) This function adds an ERC20 token to the approved tokens list.
     */
    function approveToken(address _token)
        public
        onlyGovernor()
        isCompliantToken(_token)
    {
        approvedTokens.insert(_token);
    }

    /**
     * @dev (C4) This function sets a proportion for a token in the basket,
     * allowing this smart contract to receive them. This proportions are
     * stored as fixidity units.
     * TODO: Think on the user experience of changing proportions and how
     * to sanity-check that they add up.
     */
    function setTokenTargetProportion(address _token, int256 _proportion)
        public
        onlyGovernor()
    {
        require(
            approvedTokens.contains(_token),
            "The given token isn't listed as accepted."
        );
        proportions[_token] = _proportion;
    }
}
