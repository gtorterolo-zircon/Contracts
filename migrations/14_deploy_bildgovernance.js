const BILDGovernance = artifacts.require('./BILDGovernance.sol');
const Whitelist = artifacts.require('./Whitelist.sol');
const UtilsLib = artifacts.require('./UtilsLib.sol');

module.exports = (deployer) => {
    // deploy UtilsLib
    deployer.deploy(UtilsLib);
    deployer.link(UtilsLib, BILDGovernance);
    // deploy bild
    deployer.deploy(BILDGovernance, Whitelist.address);
};
