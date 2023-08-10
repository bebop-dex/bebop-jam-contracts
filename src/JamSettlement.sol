// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "./JamBalanceManager.sol";
import "./JamSigning.sol";
import "./interfaces/IJamBalanceManager.sol";
import "./interfaces/IJamSettlement.sol";
import "./interfaces/IWETH.sol";
import "./libraries/JamInteraction.sol";
import "./libraries/JamOrder.sol";
import "./libraries/JamHooks.sol";
import "./libraries/JamTransfer.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

/// @title JamSettlement
/// @notice The settlement contract executes the full lifecycle of a trade on chain. It can only be executed by whitelisted addresses (solvers)
/// Solvers figure out what "interactions" to pass to this contract such that the user order is fulfilled.
/// The contract ensures that only the user agreed price can be executed and otherwise will fail to execute.
/// As long as the trade is fulfilled, the solver is allowed to keep any potential excess.
contract JamSettlement is IJamSettlement, ReentrancyGuard, JamSigning, ERC721Holder, ERC1155Holder {
    IJamBalanceManager public immutable balanceManager;

    using SafeERC20 for IERC20;
    address private constant NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    constructor(address _permit2) {
        balanceManager = new JamBalanceManager(address(this), _permit2);
    }

    receive() external payable {}

    function verifyBalances(
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256[] memory initialAmounts,
        uint256[] calldata nftIds,
        bytes calldata tokenTransferTypes,
        address receiver
    ) internal {
        uint nftInd;
        for (uint i; i < tokens.length; ++i) {
            if (tokenTransferTypes[i] == Commands.SIMPLE_TRANSFER) {
                uint tokenBalance = IERC20(tokens[i]).balanceOf(receiver);
                require(tokenBalance - initialAmounts[i] >= amounts[i], "INVALID_OUTPUT_TOKEN_BALANCE");
            } else if (tokenTransferTypes[i] == Commands.NATIVE_TRANSFER){
                uint tokenBalance = receiver.balance;
                require(tokenBalance - initialAmounts[i] >= amounts[i], "INVALID_OUTPUT_NATIVE_BALANCE");
            } else if (tokenTransferTypes[i] == Commands.NFT_ERC721_TRANSFER) {
                require(IERC721(tokens[i]).ownerOf(nftIds[nftInd++]) == receiver, "INVALID_ERC721_RECEIVER");
            } else if (tokenTransferTypes[i] == Commands.NFT_ERC1155_TRANSFER) {
                uint tokenBalance = IERC1155(tokens[i]).balanceOf(receiver, nftIds[nftInd++]);
                require(tokenBalance - initialAmounts[i] >= amounts[i], "INVALID_OUTPUT_ERC1155_BALANCE");
            } else {
                revert("INVALID_TRANSFER_TYPE");
            }
        }
    }

    function getInitialBalances(
        address[] calldata tokens,
        uint256[] calldata nftIds,
        bytes calldata tokenTransferTypes,
        address receiver
    ) internal returns (uint256[] memory initialBalances){
        uint256[] memory initialBalances = new uint256[](tokens.length);
        uint nftInd;
        for (uint i; i < tokens.length; ++i) {
            if (tokenTransferTypes[i] == Commands.SIMPLE_TRANSFER) {
                initialBalances[i] = IERC20(tokens[i]).balanceOf(receiver);
            } else if (tokenTransferTypes[i] == Commands.NATIVE_TRANSFER){
                require(tokens[i] == NATIVE_TOKEN, "INVALID_OUTPUT_TOKEN");
                initialBalances[i] = receiver.balance;
            } else if (tokenTransferTypes[i] == Commands.NFT_ERC721_TRANSFER) {
                ++nftInd;
            } else if (tokenTransferTypes[i] == Commands.NFT_ERC1155_TRANSFER) {
                initialBalances[i] = IERC1155(tokens[i]).balanceOf(receiver, nftIds[nftInd++]);
            }
        }
        return initialBalances;
    }

    function runInteractions(JamInteraction.Data[] calldata interactions) internal returns (bool result) {
        for (uint i; i < interactions.length; ++i) {
            // Prevent calls to balance manager
            require(interactions[i].to != address(balanceManager));
            bool execResult = JamInteraction.execute(interactions[i]);

            // Return false only if interaction was meant to succeed but failed.
            if (!execResult && interactions[i].result) return false;
        }
        return true;
    }

    /// @inheritdoc IJamSettlement
    function settle(
        JamOrder.Data calldata order,
        Signature.TypedSignature calldata signature,
        JamInteraction.Data[] calldata interactions,
        JamHooks.Def calldata hooks,
        address balanceRecipient
    ) external payable nonReentrant {
        validateOrder(order, hooks, signature);
        require(runInteractions(hooks.beforeSettle), "BEFORE_SETTLE_HOOKS_FAILED");
        balanceManager.transferTokens(
            order.taker, balanceRecipient, order.sellTokens, order.sellAmounts, order.sellNFTIds, order.sellTokenTransfers
        );
        uint256[] memory initialReceiverBalances = getInitialBalances(
            order.buyTokens,order.buyNFTIds, order.buyTokenTransfers, order.receiver
        );
        require(runInteractions(interactions), "INTERACTIONS_FAILED");
        verifyBalances(order.buyTokens, order.buyAmounts, initialReceiverBalances, order.buyNFTIds, order.buyTokenTransfers, order.receiver);
        require(runInteractions(hooks.afterSettle), "AFTER_SETTLE_HOOKS_FAILED");
        emit Settlement(msg.sender, order.nonce);
    }
}