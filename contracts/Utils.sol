pragma solidity ^0.5.0;


library Utils {
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