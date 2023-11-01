**THIS CHECKLIST IS NOT COMPLETE**. Use `--show-ignored-findings` to show all the results.
Summary
 - [arbitrary-send-erc20](#arbitrary-send-erc20) (2 results) (High)
 - [arbitrary-send-eth](#arbitrary-send-eth) (1 results) (High)
 - [pess-double-entry-token-alert](#pess-double-entry-token-alert) (1 results) (High)
 - [pess-strange-setter](#pess-strange-setter) (5 results) (High)
 - [unchecked-lowlevel](#unchecked-lowlevel) (2 results) (Medium)
 - [uninitialized-local](#uninitialized-local) (18 results) (Medium)
 - [unused-return](#unused-return) (1 results) (Medium)
 - [pess-nft-approve-warning](#pess-nft-approve-warning) (4 results) (Medium)
 - [pess-call-forward-to-protected](#pess-call-forward-to-protected) (4 results) (Medium)
 - [missing-zero-check](#missing-zero-check) (6 results) (Low)
 - [calls-loop](#calls-loop) (28 results) (Low)
 - [reentrancy-events](#reentrancy-events) (3 results) (Low)
 - [timestamp](#timestamp) (1 results) (Low)
 - [pess-dubious-typecast](#pess-dubious-typecast) (7 results) (Low)
 - [pess-event-setter](#pess-event-setter) (4 results) (Low)
 - [assembly](#assembly) (4 results) (Informational)
 - [cyclomatic-complexity](#cyclomatic-complexity) (1 results) (Informational)
 - [solc-version](#solc-version) (17 results) (Informational)
 - [low-level-calls](#low-level-calls) (5 results) (Informational)
 - [naming-convention](#naming-convention) (5 results) (Informational)
 - [similar-names](#similar-names) (4 results) (Informational)
 - [unused-state](#unused-state) (1 results) (Informational)
 - [pess-magic-number](#pess-magic-number) (6 results) (Informational)
 - [immutable-states](#immutable-states) (2 results) (Optimization)
 - [pess-multiple-storage-read](#pess-multiple-storage-read) (1 results) (Optimization)
## arbitrary-send-erc20
Impact: High
Confidence: High
 - [ ] ID-0
[JamBalanceManager.transferTokens(IJamBalanceManager.TransferData)](src/JamBalanceManager.sol#L44-L91) uses arbitrary from in transferFrom: [IERC20(data.tokens[i]).safeTransferFrom(data.from,data.receiver,BMath.getPercentage(data.amounts[i],data.fillPercent))](src/JamBalanceManager.sol#L52-L54)

src/JamBalanceManager.sol#L44-L91


 - [ ] ID-1
[JamBalanceManager.transferTokensWithPermits(IJamBalanceManager.TransferData,Signature.TakerPermitsInfo)](src/JamBalanceManager.sol#L94-L175) uses arbitrary from in transferFrom: [IERC20(data.tokens[i]).safeTransferFrom(data.from,data.receiver,BMath.getPercentage(data.amounts[i],data.fillPercent))](src/JamBalanceManager.sol#L108-L110)

src/JamBalanceManager.sol#L94-L175


## arbitrary-send-eth
Impact: High
Confidence: Medium
 - [ ] ID-2
[JamTransfer.transferNativeFromContract(address,uint256)](src/base/JamTransfer.sol#L67-L70) sends eth to arbitrary user
	Dangerous calls:
	- [(sent) = address(receiver).call{value: amount}()](src/base/JamTransfer.sol#L68)

src/base/JamTransfer.sol#L67-L70


## pess-double-entry-token-alert
Impact: High
Confidence: Low
 - [ ] ID-3
JamTransfer [JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool)](src/base/JamTransfer.sol#L24-L62) might be vulnerable to double-entry token exploit

src/base/JamTransfer.sol#L24-L62


## pess-strange-setter
Impact: High
Confidence: Medium
 - [ ] ID-4
Function [JamSettlement.settleBatch(JamOrder.Data[],Signature.TypedSignature[],Signature.TakerPermitsInfo[],JamInteraction.Data[],JamHooks.Def[],ExecInfo.BatchSolverData)](src/JamSettlement.sol#L122-L167) is a strange setter. Nothing is set in constructor or set in a function without using function parameters

src/JamSettlement.sol#L122-L167


 - [ ] ID-5
Function [JamSettlement.settle(JamOrder.Data,Signature.TypedSignature,JamInteraction.Data[],JamHooks.Def,ExecInfo.SolverData)](src/JamSettlement.sol#L46-L62) is a strange setter. Nothing is set in constructor or set in a function without using function parameters

src/JamSettlement.sol#L46-L62


 - [ ] ID-6
Function [JamSettlement.settleInternalWithPermitsSignatures(JamOrder.Data,Signature.TypedSignature,Signature.TakerPermitsInfo,JamHooks.Def,ExecInfo.MakerData)](src/JamSettlement.sol#L103-L119) is a strange setter. Nothing is set in constructor or set in a function without using function parameters

src/JamSettlement.sol#L103-L119


 - [ ] ID-7
Function [JamSettlement.settleInternal(JamOrder.Data,Signature.TypedSignature,JamHooks.Def,ExecInfo.MakerData)](src/JamSettlement.sol#L85-L100) is a strange setter. Nothing is set in constructor or set in a function without using function parameters

src/JamSettlement.sol#L85-L100


 - [ ] ID-8
Function [JamSettlement.settleWithPermitsSignatures(JamOrder.Data,Signature.TypedSignature,Signature.TakerPermitsInfo,JamInteraction.Data[],JamHooks.Def,ExecInfo.SolverData)](src/JamSettlement.sol#L65-L82) is a strange setter. Nothing is set in constructor or set in a function without using function parameters

src/JamSettlement.sol#L65-L82


## unchecked-lowlevel
Impact: Medium
Confidence: Medium
 - [ ] ID-9
[JamSolver.execute(JamInteraction.Data[],address[],uint256[],uint256[],bytes,address)](src/JamSolver.sol#L59-L81) ignores return value by [address(receiver).call{value: outputAmounts[i_scope_0]}()](src/JamSolver.sol#L72)

src/JamSolver.sol#L59-L81


 - [ ] ID-10
[JamSolver.withdraw(address)](src/JamSolver.sol#L44-L48) ignores return value by [address(receiver).call{value: address(this).balance}()](src/JamSolver.sol#L46)

src/JamSolver.sol#L44-L48


## uninitialized-local
Impact: Medium
Confidence: Medium
 - [ ] ID-11
[JamSettlement._settle(JamOrder.Data,JamInteraction.Data[],JamHooks.Def,uint16).i](src/JamSettlement.sol#L182) is a local variable never initialized

src/JamSettlement.sol#L182


 - [ ] ID-12
[JamTransfer.calculateNewAmounts(uint256,JamOrder.Data[],uint16[]).k](src/base/JamTransfer.sol#L89) is a local variable never initialized

src/base/JamTransfer.sol#L89


 - [ ] ID-13
[JamSigning.validateBatchOrders(JamOrder.Data[],JamHooks.Def[],Signature.TypedSignature[],Signature.TakerPermitsInfo[],bool[],uint16[]).i](src/base/JamSigning.sol#L224) is a local variable never initialized

src/base/JamSigning.sol#L224


 - [ ] ID-14
[JamSolver.withdrawTokens(address[],address).i](src/JamSolver.sol#L51) is a local variable never initialized

src/JamSolver.sol#L51


 - [ ] ID-15
[JamTransfer.calculateNewAmounts(uint256,JamOrder.Data[],uint16[]).fullAmount](src/base/JamTransfer.sol#L87) is a local variable never initialized

src/base/JamTransfer.sol#L87


 - [ ] ID-16
[JamTransfer.hasDuplicate(address[],uint256[],bytes).i](src/base/JamTransfer.sol#L124) is a local variable never initialized

src/base/JamTransfer.sol#L124


 - [ ] ID-17
[JamSolver.execute(JamInteraction.Data[],address[],uint256[],uint256[],bytes,address).i](src/JamSolver.sol#L63) is a local variable never initialized

src/JamSolver.sol#L63


 - [ ] ID-18
[JamTransfer.hasDuplicate(address[],uint256[],bytes).curNftInd](src/base/JamTransfer.sol#L123) is a local variable never initialized

src/base/JamTransfer.sol#L123


 - [ ] ID-19
[JamTransfer.calculateNewAmounts(uint256,JamOrder.Data[],uint16[]).i](src/base/JamTransfer.sol#L85) is a local variable never initialized

src/base/JamTransfer.sol#L85


 - [ ] ID-20
[JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool).nftInd](src/base/JamTransfer.sol#L33) is a local variable never initialized

src/base/JamTransfer.sol#L33


 - [ ] ID-21
[JamSettlement.runInteractions(JamInteraction.Data[]).i](src/JamSettlement.sol#L34) is a local variable never initialized

src/JamSettlement.sol#L34


 - [ ] ID-22
[JamSigning.validateBatchOrders(JamOrder.Data[],JamHooks.Def[],Signature.TypedSignature[],Signature.TakerPermitsInfo[],bool[],uint16[]).takersWithPermits](src/base/JamSigning.sol#L223) is a local variable never initialized

src/base/JamSigning.sol#L223


 - [ ] ID-23
[JamSettlement.settleBatch(JamOrder.Data[],Signature.TypedSignature[],Signature.TakerPermitsInfo[],JamInteraction.Data[],JamHooks.Def[],ExecInfo.BatchSolverData).i_scope_0](src/JamSettlement.sol#L155) is a local variable never initialized

src/JamSettlement.sol#L155


 - [ ] ID-24
[JamSettlement.settleBatch(JamOrder.Data[],Signature.TypedSignature[],Signature.TakerPermitsInfo[],JamInteraction.Data[],JamHooks.Def[],ExecInfo.BatchSolverData).i](src/JamSettlement.sol#L134) is a local variable never initialized

src/JamSettlement.sol#L134


 - [ ] ID-25
[JamSettlement.settleBatch(JamOrder.Data[],Signature.TypedSignature[],Signature.TakerPermitsInfo[],JamInteraction.Data[],JamHooks.Def[],ExecInfo.BatchSolverData).takersPermitsInd](src/JamSettlement.sol#L133) is a local variable never initialized

src/JamSettlement.sol#L133


 - [ ] ID-26
[JamSigning.validateIncreasedAmounts(uint256[],uint256[]).i](src/base/JamSigning.sol#L201) is a local variable never initialized

src/base/JamSigning.sol#L201


 - [ ] ID-27
[JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool).i](src/base/JamTransfer.sol#L34) is a local variable never initialized

src/base/JamTransfer.sol#L34


 - [ ] ID-28
[JamSolver.execute(JamInteraction.Data[],address[],uint256[],uint256[],bytes,address).i_scope_0](src/JamSolver.sol#L67) is a local variable never initialized

src/JamSolver.sol#L67


## unused-return
Impact: Medium
Confidence: Medium
 - [ ] ID-29
[JamSolver.execute(JamInteraction.Data[],address[],uint256[],uint256[],bytes,address)](src/JamSolver.sol#L59-L81) ignores return value by [JamInteraction.execute(calls[i])](src/JamSolver.sol#L64)

src/JamSolver.sol#L59-L81


## pess-nft-approve-warning
Impact: Medium
Confidence: Low
 - [ ] ID-30
JamBalanceManager transferTokens parameter from is not related to msg.sender [IERC721(data.tokens[i]).safeTransferFrom(data.from,data.receiver,data.nftIds[nftsInd ++])](src/JamBalanceManager.sol#L75)

src/JamBalanceManager.sol#L75


 - [ ] ID-31
JamTransfer transferTokensFromContract parameter from is not related to msg.sender [IERC721(tokens[i]).safeTransferFrom(address(this),receiver,nftIds[nftInd ++])](src/base/JamTransfer.sol#L50)

src/base/JamTransfer.sol#L50


 - [ ] ID-32
JamSolver execute parameter from is not related to msg.sender [token_scope_1.safeTransferFrom(address(this),receiver,outputIds[i_scope_0])](src/JamSolver.sol#L75)

src/JamSolver.sol#L75


 - [ ] ID-33
JamBalanceManager transferTokensWithPermits parameter from is not related to msg.sender [IERC721(data.tokens[i]).safeTransferFrom(data.from,data.receiver,data.nftIds[indices.nftsInd ++])](src/JamBalanceManager.sol#L141)

src/JamBalanceManager.sol#L141


## pess-call-forward-to-protected
Impact: Medium
Confidence: Low
 - [ ] ID-34
Function [JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool)](src/base/JamTransfer.sol#L24-L62) contains a low level call to a custom address

src/base/JamTransfer.sol#L24-L62


 - [ ] ID-35
Function [JamTransfer.transferNativeFromContract(address,uint256)](src/base/JamTransfer.sol#L67-L70) contains a low level call to a custom address

src/base/JamTransfer.sol#L67-L70


 - [ ] ID-36
Function [JamSolver.withdraw(address)](src/JamSolver.sol#L44-L48) contains a low level call to a custom address

src/JamSolver.sol#L44-L48


 - [ ] ID-37
Function [JamSolver.execute(JamInteraction.Data[],address[],uint256[],uint256[],bytes,address)](src/JamSolver.sol#L59-L81) contains a low level call to a custom address

src/JamSolver.sol#L59-L81


## missing-zero-check
Impact: Low
Confidence: Medium
 - [ ] ID-38
[JamSolver.withdraw(address).receiver](src/JamSolver.sol#L44) lacks a zero-check on :
		- [address(receiver).call{value: address(this).balance}()](src/JamSolver.sol#L46)

src/JamSolver.sol#L44


 - [ ] ID-39
[JamBalanceManager.constructor(address,address,address)._operator](src/JamBalanceManager.sol#L29) lacks a zero-check on :
		- [operator = _operator](src/JamBalanceManager.sol#L32)

src/JamBalanceManager.sol#L29


 - [ ] ID-40
[JamSolver.constructor(address)._settlement](src/JamSolver.sol#L22) lacks a zero-check on :
		- [settlement = _settlement](src/JamSolver.sol#L24)

src/JamSolver.sol#L22


 - [ ] ID-41
[JamBalanceManager.constructor(address,address,address)._daiAddress](src/JamBalanceManager.sol#L29) lacks a zero-check on :
		- [DAI_TOKEN = _daiAddress](src/JamBalanceManager.sol#L35)

src/JamBalanceManager.sol#L29


 - [ ] ID-42
[JamSolver.execute(JamInteraction.Data[],address[],uint256[],uint256[],bytes,address).receiver](src/JamSolver.sol#L61) lacks a zero-check on :
		- [address(receiver).call{value: outputAmounts[i_scope_0]}()](src/JamSolver.sol#L72)

src/JamSolver.sol#L61


 - [ ] ID-43
[JamTransfer.transferNativeFromContract(address,uint256).receiver](src/base/JamTransfer.sol#L67) lacks a zero-check on :
		- [(sent) = address(receiver).call{value: amount}()](src/base/JamTransfer.sol#L68)

src/base/JamTransfer.sol#L67


## calls-loop
Impact: Low
Confidence: Medium
 - [ ] ID-44
[JamSolver.execute(JamInteraction.Data[],address[],uint256[],uint256[],bytes,address)](src/JamSolver.sol#L59-L81) has external calls inside a loop: [address(receiver).call{value: outputAmounts[i_scope_0]}()](src/JamSolver.sol#L72)

src/JamSolver.sol#L59-L81


 - [ ] ID-45
[JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool)](src/base/JamTransfer.sol#L24-L62) has external calls inside a loop: [tokenBalance_scope_2 = IERC721(tokens[i]).balanceOf(address(this))](src/base/JamTransfer.sol#L48)

src/base/JamTransfer.sol#L24-L62


 - [ ] ID-46
[JamSolver.execute(JamInteraction.Data[],address[],uint256[],uint256[],bytes,address)](src/JamSolver.sol#L59-L81) has external calls inside a loop: [token_scope_2.safeTransferFrom(address(this),receiver,outputIds[i_scope_0],outputAmounts[i_scope_0],)](src/JamSolver.sol#L78)

src/JamSolver.sol#L59-L81


 - [ ] ID-47
[JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool)](src/base/JamTransfer.sol#L24-L62) has external calls inside a loop: [(sent) = address(receiver).call{value: tokenBalance_scope_0}()](src/base/JamTransfer.sol#L45)

src/base/JamTransfer.sol#L24-L62


 - [ ] ID-48
[JamSettlement.settleBatch(JamOrder.Data[],Signature.TypedSignature[],Signature.TakerPermitsInfo[],JamInteraction.Data[],JamHooks.Def[],ExecInfo.BatchSolverData)](src/JamSettlement.sol#L122-L167) has external calls inside a loop: [balanceManager.transferTokensWithPermits(IJamBalanceManager.TransferData(orders[i].taker,solverData.balanceRecipient,orders[i].sellTokens,orders[i].sellAmounts,orders[i].sellNFTIds,orders[i].sellTokenTransfers,solverData.curFillPercents[i]),takersPermitsInfo[takersPermitsInd ++])](src/JamSettlement.sol#L139-L144)

src/JamSettlement.sol#L122-L167


 - [ ] ID-49
[JamSolver.withdrawTokens(address[],address)](src/JamSolver.sol#L50-L57) has external calls inside a loop: [token.balanceOf(address(this)) > 0](src/JamSolver.sol#L53)

src/JamSolver.sol#L50-L57


 - [ ] ID-50
[JamSettlement.settleBatch(JamOrder.Data[],Signature.TypedSignature[],Signature.TakerPermitsInfo[],JamInteraction.Data[],JamHooks.Def[],ExecInfo.BatchSolverData)](src/JamSettlement.sol#L122-L167) has external calls inside a loop: [balanceManager.transferTokens(IJamBalanceManager.TransferData(orders[i].taker,solverData.balanceRecipient,orders[i].sellTokens,orders[i].sellAmounts,orders[i].sellNFTIds,orders[i].sellTokenTransfers,solverData.curFillPercents[i]))](src/JamSettlement.sol#L146-L151)

src/JamSettlement.sol#L122-L167


 - [ ] ID-51
[JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool)](src/base/JamTransfer.sol#L24-L62) has external calls inside a loop: [tokenBalance_scope_3 = IERC1155(tokens[i]).balanceOf(address(this),nftIds[nftInd])](src/base/JamTransfer.sol#L52)

src/base/JamTransfer.sol#L24-L62


 - [ ] ID-52
[JamBalanceManager.transferTokensWithPermits(IJamBalanceManager.TransferData,Signature.TakerPermitsInfo)](src/JamBalanceManager.sol#L94-L175) has external calls inside a loop: [JamTransfer(operator).transferNativeFromContract(data.receiver,BMath.getPercentage(data.amounts[i],data.fillPercent))](src/JamBalanceManager.sol#L135-L137)

src/JamBalanceManager.sol#L94-L175


 - [ ] ID-53
[JamBalanceManager.transferTokens(IJamBalanceManager.TransferData)](src/JamBalanceManager.sol#L44-L91) has external calls inside a loop: [IERC721(data.tokens[i]).safeTransferFrom(data.from,data.receiver,data.nftIds[nftsInd ++])](src/JamBalanceManager.sol#L75)

src/JamBalanceManager.sol#L44-L91


 - [ ] ID-54
[JamBalanceManager.permitToken(address,address,uint256,bytes)](src/JamBalanceManager.sol#L182-L201) has external calls inside a loop: [IERC20Permit(tokenAddress).permit(takerAddress,address(this),type()(uint256).max,deadline,v,r,s)](src/JamBalanceManager.sol#L198)

src/JamBalanceManager.sol#L182-L201


 - [ ] ID-55
[JamSettlement.settleBatch(JamOrder.Data[],Signature.TypedSignature[],Signature.TakerPermitsInfo[],JamInteraction.Data[],JamHooks.Def[],ExecInfo.BatchSolverData)](src/JamSettlement.sol#L122-L167) has external calls inside a loop: [balanceManager.transferTokens(IJamBalanceManager.TransferData(orders[i].taker,solverData.balanceRecipient,orders[i].sellTokens,orders[i].sellAmounts,orders[i].sellNFTIds,orders[i].sellTokenTransfers,BMath.HUNDRED_PERCENT))](src/JamSettlement.sol#L146-L151)

src/JamSettlement.sol#L122-L167


 - [ ] ID-56
[JamTransfer.calculateNewAmounts(uint256,JamOrder.Data[],uint16[])](src/base/JamTransfer.sol#L77-L109) has external calls inside a loop: [tokenBalance = IERC20(curOrder.buyTokens[i]).balanceOf(address(this))](src/base/JamTransfer.sol#L96-L97)

src/base/JamTransfer.sol#L77-L109


 - [ ] ID-57
[JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool)](src/base/JamTransfer.sol#L24-L62) has external calls inside a loop: [IERC1155(tokens[i]).safeTransferFrom(address(this),receiver,nftIds[nftInd ++],tokenBalance_scope_3,)](src/base/JamTransfer.sol#L54-L56)

src/base/JamTransfer.sol#L24-L62


 - [ ] ID-58
[JamSolver.withdrawTokens(address[],address)](src/JamSolver.sol#L50-L57) has external calls inside a loop: [token.safeTransfer(receiver,token.balanceOf(address(this)))](src/JamSolver.sol#L54)

src/JamSolver.sol#L50-L57


 - [ ] ID-59
[JamInteraction.execute(JamInteraction.Data)](src/libraries/JamInteraction.sol#L18-L21) has external calls inside a loop: [(_result) = address(interaction.to).call{value: interaction.value}(interaction.data)](src/libraries/JamInteraction.sol#L19)

src/libraries/JamInteraction.sol#L18-L21


 - [ ] ID-60
[JamBalanceManager.transferTokens(IJamBalanceManager.TransferData)](src/JamBalanceManager.sol#L44-L91) has external calls inside a loop: [IERC1155(data.tokens[i]).safeTransferFrom(data.from,data.receiver,data.nftIds[nftsInd ++],data.amounts[i],)](src/JamBalanceManager.sol#L77)

src/JamBalanceManager.sol#L44-L91


 - [ ] ID-61
[JamSolver.execute(JamInteraction.Data[],address[],uint256[],uint256[],bytes,address)](src/JamSolver.sol#L59-L81) has external calls inside a loop: [token_scope_1.safeTransferFrom(address(this),receiver,outputIds[i_scope_0])](src/JamSolver.sol#L75)

src/JamSolver.sol#L59-L81


 - [ ] ID-62
[JamBalanceManager.transferTokensWithPermits(IJamBalanceManager.TransferData,Signature.TakerPermitsInfo)](src/JamBalanceManager.sol#L94-L175) has external calls inside a loop: [IERC721(data.tokens[i]).safeTransferFrom(data.from,data.receiver,data.nftIds[indices.nftsInd ++])](src/JamBalanceManager.sol#L141)

src/JamBalanceManager.sol#L94-L175


 - [ ] ID-63
[JamBalanceManager.transferTokensWithPermits(IJamBalanceManager.TransferData,Signature.TakerPermitsInfo)](src/JamBalanceManager.sol#L94-L175) has external calls inside a loop: [IERC1155(data.tokens[i]).safeTransferFrom(data.from,data.receiver,data.nftIds[indices.nftsInd ++],data.amounts[i],)](src/JamBalanceManager.sol#L143)

src/JamBalanceManager.sol#L94-L175


 - [ ] ID-64
[JamSettlement.settleBatch(JamOrder.Data[],Signature.TypedSignature[],Signature.TakerPermitsInfo[],JamInteraction.Data[],JamHooks.Def[],ExecInfo.BatchSolverData)](src/JamSettlement.sol#L122-L167) has external calls inside a loop: [balanceManager.transferTokensWithPermits(IJamBalanceManager.TransferData(orders[i].taker,solverData.balanceRecipient,orders[i].sellTokens,orders[i].sellAmounts,orders[i].sellNFTIds,orders[i].sellTokenTransfers,10000),takersPermitsInfo[takersPermitsInd ++])](src/JamSettlement.sol#L139-L144)

src/JamSettlement.sol#L122-L167


 - [ ] ID-65
[JamBalanceManager.permitToken(address,address,uint256,bytes)](src/JamBalanceManager.sol#L182-L201) has external calls inside a loop: [IDaiLikePermit(tokenAddress).permit(takerAddress,address(this),IERC20Permit(tokenAddress).nonces(takerAddress),deadline,true,v,r,s)](src/JamBalanceManager.sol#L193-L195)

src/JamBalanceManager.sol#L182-L201


 - [ ] ID-66
[JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool)](src/base/JamTransfer.sol#L24-L62) has external calls inside a loop: [IERC1155(tokens[i]).safeTransferFrom(address(this),receiver,nftIds[nftInd ++],amounts[i],)](src/base/JamTransfer.sol#L54-L56)

src/base/JamTransfer.sol#L24-L62


 - [ ] ID-67
[JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool)](src/base/JamTransfer.sol#L24-L62) has external calls inside a loop: [(sent) = address(receiver).call{value: partialFillAmount_scope_1}()](src/base/JamTransfer.sol#L45)

src/base/JamTransfer.sol#L24-L62


 - [ ] ID-68
[JamBalanceManager.permitToken(address,address,uint256,bytes)](src/JamBalanceManager.sol#L182-L201) has external calls inside a loop: [IDaiLikePermit(tokenAddress).permit(takerAddress,address(this),IDaiLikePermit(tokenAddress).getNonce(takerAddress),deadline,true,v,r,s)](src/JamBalanceManager.sol#L189-L191)

src/JamBalanceManager.sol#L182-L201


 - [ ] ID-69
[JamBalanceManager.transferTokens(IJamBalanceManager.TransferData)](src/JamBalanceManager.sol#L44-L91) has external calls inside a loop: [JamTransfer(operator).transferNativeFromContract(data.receiver,BMath.getPercentage(data.amounts[i],data.fillPercent))](src/JamBalanceManager.sol#L69-L71)

src/JamBalanceManager.sol#L44-L91


 - [ ] ID-70
[JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool)](src/base/JamTransfer.sol#L24-L62) has external calls inside a loop: [tokenBalance = IERC20(tokens[i]).balanceOf(address(this))](src/base/JamTransfer.sol#L36)

src/base/JamTransfer.sol#L24-L62


 - [ ] ID-71
[JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool)](src/base/JamTransfer.sol#L24-L62) has external calls inside a loop: [IERC721(tokens[i]).safeTransferFrom(address(this),receiver,nftIds[nftInd ++])](src/base/JamTransfer.sol#L50)

src/base/JamTransfer.sol#L24-L62


## reentrancy-events
Impact: Low
Confidence: Medium
 - [ ] ID-72
Reentrancy in [JamSettlement._settleInternal(JamOrder.Data,JamHooks.Def,ExecInfo.MakerData)](src/JamSettlement.sol#L190-L204):
	External calls:
	- [balanceManager.transferTokens(IJamBalanceManager.TransferData(msg.sender,order.receiver,order.buyTokens,buyAmounts,order.buyNFTIds,order.buyTokenTransfers,makerData.curFillPercent))](src/JamSettlement.sol#L196-L201)
	- [require(bool,string)(runInteractions(hooks.afterSettle),AFTER_SETTLE_HOOKS_FAILED)](src/JamSettlement.sol#L202)
		- [(_result) = address(interaction.to).call{value: interaction.value}(interaction.data)](src/libraries/JamInteraction.sol#L19)
		- [execResult = JamInteraction.execute(interactions[i])](src/JamSettlement.sol#L37)
	External calls sending eth:
	- [require(bool,string)(runInteractions(hooks.afterSettle),AFTER_SETTLE_HOOKS_FAILED)](src/JamSettlement.sol#L202)
		- [(_result) = address(interaction.to).call{value: interaction.value}(interaction.data)](src/libraries/JamInteraction.sol#L19)
	Event emitted after the call(s):
	- [Settlement(order.nonce)](src/JamSettlement.sol#L203)

src/JamSettlement.sol#L190-L204


 - [ ] ID-73
Reentrancy in [JamSettlement.settleInternalWithPermitsSignatures(JamOrder.Data,Signature.TypedSignature,Signature.TakerPermitsInfo,JamHooks.Def,ExecInfo.MakerData)](src/JamSettlement.sol#L103-L119):
	External calls:
	- [require(bool,string)(runInteractions(hooks.beforeSettle),BEFORE_SETTLE_HOOKS_FAILED)](src/JamSettlement.sol#L111)
		- [(_result) = address(interaction.to).call{value: interaction.value}(interaction.data)](src/libraries/JamInteraction.sol#L19)
		- [execResult = JamInteraction.execute(interactions[i])](src/JamSettlement.sol#L37)
	- [balanceManager.transferTokensWithPermits(IJamBalanceManager.TransferData(order.taker,msg.sender,order.sellTokens,order.sellAmounts,order.sellNFTIds,order.sellTokenTransfers,makerData.curFillPercent),takerPermitsInfo)](src/JamSettlement.sol#L112-L117)
	- [_settleInternal(order,hooks,makerData)](src/JamSettlement.sol#L118)
		- [balanceManager.transferTokens(IJamBalanceManager.TransferData(msg.sender,order.receiver,order.buyTokens,buyAmounts,order.buyNFTIds,order.buyTokenTransfers,makerData.curFillPercent))](src/JamSettlement.sol#L196-L201)
		- [(_result) = address(interaction.to).call{value: interaction.value}(interaction.data)](src/libraries/JamInteraction.sol#L19)
		- [execResult = JamInteraction.execute(interactions[i])](src/JamSettlement.sol#L37)
	External calls sending eth:
	- [require(bool,string)(runInteractions(hooks.beforeSettle),BEFORE_SETTLE_HOOKS_FAILED)](src/JamSettlement.sol#L111)
		- [(_result) = address(interaction.to).call{value: interaction.value}(interaction.data)](src/libraries/JamInteraction.sol#L19)
	- [_settleInternal(order,hooks,makerData)](src/JamSettlement.sol#L118)
		- [(_result) = address(interaction.to).call{value: interaction.value}(interaction.data)](src/libraries/JamInteraction.sol#L19)
	Event emitted after the call(s):
	- [Settlement(order.nonce)](src/JamSettlement.sol#L203)
		- [_settleInternal(order,hooks,makerData)](src/JamSettlement.sol#L118)

src/JamSettlement.sol#L103-L119


 - [ ] ID-74
Reentrancy in [JamSettlement.settleInternal(JamOrder.Data,Signature.TypedSignature,JamHooks.Def,ExecInfo.MakerData)](src/JamSettlement.sol#L85-L100):
	External calls:
	- [require(bool,string)(runInteractions(hooks.beforeSettle),BEFORE_SETTLE_HOOKS_FAILED)](src/JamSettlement.sol#L92)
		- [(_result) = address(interaction.to).call{value: interaction.value}(interaction.data)](src/libraries/JamInteraction.sol#L19)
		- [execResult = JamInteraction.execute(interactions[i])](src/JamSettlement.sol#L37)
	- [balanceManager.transferTokens(IJamBalanceManager.TransferData(order.taker,msg.sender,order.sellTokens,order.sellAmounts,order.sellNFTIds,order.sellTokenTransfers,makerData.curFillPercent))](src/JamSettlement.sol#L93-L98)
	- [_settleInternal(order,hooks,makerData)](src/JamSettlement.sol#L99)
		- [balanceManager.transferTokens(IJamBalanceManager.TransferData(msg.sender,order.receiver,order.buyTokens,buyAmounts,order.buyNFTIds,order.buyTokenTransfers,makerData.curFillPercent))](src/JamSettlement.sol#L196-L201)
		- [(_result) = address(interaction.to).call{value: interaction.value}(interaction.data)](src/libraries/JamInteraction.sol#L19)
		- [execResult = JamInteraction.execute(interactions[i])](src/JamSettlement.sol#L37)
	External calls sending eth:
	- [require(bool,string)(runInteractions(hooks.beforeSettle),BEFORE_SETTLE_HOOKS_FAILED)](src/JamSettlement.sol#L92)
		- [(_result) = address(interaction.to).call{value: interaction.value}(interaction.data)](src/libraries/JamInteraction.sol#L19)
	- [_settleInternal(order,hooks,makerData)](src/JamSettlement.sol#L99)
		- [(_result) = address(interaction.to).call{value: interaction.value}(interaction.data)](src/libraries/JamInteraction.sol#L19)
	Event emitted after the call(s):
	- [Settlement(order.nonce)](src/JamSettlement.sol#L203)
		- [_settleInternal(order,hooks,makerData)](src/JamSettlement.sol#L99)

src/JamSettlement.sol#L85-L100


## timestamp
Impact: Low
Confidence: Medium
 - [ ] ID-75
[JamSigning.validateOrder(JamOrder.Data,JamHooks.Def,Signature.TypedSignature,uint16)](src/base/JamSigning.sol#L141-L158) uses timestamp for comparisons
	Dangerous comparisons:
	- [require(bool,string)(block.timestamp < order.expiry,ORDER_EXPIRED)](src/base/JamSigning.sol#L157)

src/base/JamSigning.sol#L141-L158


## pess-dubious-typecast
Impact: Low
Confidence: Low
 - [ ] ID-76
Function [JamSolver.withdraw(address)](src/JamSolver.sol#L44-L48) has a dubious typecast: address<=address

src/JamSolver.sol#L44-L48


 - [ ] ID-77
Function [JamTransfer.calculateNewAmounts(uint256,JamOrder.Data[],uint16[])](src/base/JamTransfer.sol#L77-L109) has a dubious typecast: address<=IERC20

src/base/JamTransfer.sol#L77-L109


 - [ ] ID-78
Function [JamBalanceManager.permitToken(address,address,uint256,bytes)](src/JamBalanceManager.sol#L182-L201) has a dubious typecast: address<=IDaiLikePermit

src/JamBalanceManager.sol#L182-L201


 - [ ] ID-79
Function [JamBalanceManager.permitToken(address,address,uint256,bytes)](src/JamBalanceManager.sol#L182-L201) has a dubious typecast: address<=IERC20Permit

src/JamBalanceManager.sol#L182-L201


 - [ ] ID-80
Function [JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool)](src/base/JamTransfer.sol#L24-L62) has a dubious typecast: address<=IERC1155

src/base/JamTransfer.sol#L24-L62


 - [ ] ID-81
Function [JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool)](src/base/JamTransfer.sol#L24-L62) has a dubious typecast: address<=IERC721

src/base/JamTransfer.sol#L24-L62


 - [ ] ID-82
Function [JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool)](src/base/JamTransfer.sol#L24-L62) has a dubious typecast: address<=IERC20

src/base/JamTransfer.sol#L24-L62


## pess-event-setter
Impact: Low
Confidence: Medium
 - [ ] ID-83
Setter function [JamSettlement.settleWithPermitsSignatures(JamOrder.Data,Signature.TypedSignature,Signature.TakerPermitsInfo,JamInteraction.Data[],JamHooks.Def,ExecInfo.SolverData)](src/JamSettlement.sol#L65-L82) does not emit an event

src/JamSettlement.sol#L65-L82


 - [ ] ID-84
Setter function [JamSettlement.settle(JamOrder.Data,Signature.TypedSignature,JamInteraction.Data[],JamHooks.Def,ExecInfo.SolverData)](src/JamSettlement.sol#L46-L62) does not emit an event

src/JamSettlement.sol#L46-L62


 - [ ] ID-85
Setter function [JamSettlement.settleInternalWithPermitsSignatures(JamOrder.Data,Signature.TypedSignature,Signature.TakerPermitsInfo,JamHooks.Def,ExecInfo.MakerData)](src/JamSettlement.sol#L103-L119) does not emit an event

src/JamSettlement.sol#L103-L119


 - [ ] ID-86
Setter function [JamSettlement.settleInternal(JamOrder.Data,Signature.TypedSignature,JamHooks.Def,ExecInfo.MakerData)](src/JamSettlement.sol#L85-L100) does not emit an event

src/JamSettlement.sol#L85-L100


## assembly
Impact: Informational
Confidence: High
 - [ ] ID-87
[JamBalanceManager.transferTokensWithPermits(IJamBalanceManager.TransferData,Signature.TakerPermitsInfo)](src/JamBalanceManager.sol#L94-L175) uses assembly
	- [INLINE ASM](src/JamBalanceManager.sol#L150)

src/JamBalanceManager.sol#L94-L175


 - [ ] ID-88
[Signature.getRsv(bytes)](src/libraries/Signature.sol#L25-L39) uses assembly
	- [INLINE ASM](src/libraries/Signature.sol#L30-L34)

src/libraries/Signature.sol#L25-L39


 - [ ] ID-89
[JamSigning.validateSignature(address,bytes32,Signature.TypedSignature)](src/base/JamSigning.sol#L105-L134) uses assembly
	- [INLINE ASM](src/base/JamSigning.sol#L120-L124)

src/base/JamSigning.sol#L105-L134


 - [ ] ID-90
[JamBalanceManager.transferTokens(IJamBalanceManager.TransferData)](src/JamBalanceManager.sol#L44-L91) uses assembly
	- [INLINE ASM](src/JamBalanceManager.sol#L82)

src/JamBalanceManager.sol#L44-L91


## cyclomatic-complexity
Impact: Informational
Confidence: High
 - [ ] ID-91
[JamBalanceManager.transferTokensWithPermits(IJamBalanceManager.TransferData,Signature.TakerPermitsInfo)](src/JamBalanceManager.sol#L94-L175) has a high cyclomatic complexity (14).

src/JamBalanceManager.sol#L94-L175


## solc-version
Impact: Informational
Confidence: High
 - [ ] ID-92
Pragma version[^0.8.17](src/base/JamSigning.sol#L2) allows old versions

src/base/JamSigning.sol#L2


 - [ ] ID-93
Pragma version[^0.8.17](src/JamSolver.sol#L2) allows old versions

src/JamSolver.sol#L2


 - [ ] ID-94
Pragma version[^0.8.17](src/libraries/Signature.sol#L2) allows old versions

src/libraries/Signature.sol#L2


 - [ ] ID-95
Pragma version[^0.8.17](src/JamSettlement.sol#L2) allows old versions

src/JamSettlement.sol#L2


 - [ ] ID-96
Pragma version[^0.8.17](src/base/JamTransfer.sol#L2) allows old versions

src/base/JamTransfer.sol#L2


 - [ ] ID-97
Pragma version[^0.8.17](src/libraries/JamInteraction.sol#L2) allows old versions

src/libraries/JamInteraction.sol#L2


 - [ ] ID-98
Pragma version[^0.8.17](src/libraries/JamHooks.sol#L2) allows old versions

src/libraries/JamHooks.sol#L2


 - [ ] ID-99
Pragma version[^0.8.17](src/libraries/common/SafeCast160.sol#L2) allows old versions

src/libraries/common/SafeCast160.sol#L2


 - [ ] ID-100
Pragma version[^0.8.17](src/libraries/JamOrder.sol#L2) allows old versions

src/libraries/JamOrder.sol#L2


 - [ ] ID-101
solc-0.8.17 is not recommended for deployment

 - [ ] ID-102
Pragma version[^0.8.17](src/interfaces/IJamSettlement.sol#L2) allows old versions

src/interfaces/IJamSettlement.sol#L2


 - [ ] ID-103
Pragma version[^0.8.17](src/interfaces/IPermit2.sol#L2) allows old versions

src/interfaces/IPermit2.sol#L2


 - [ ] ID-104
Pragma version[^0.8.17](src/interfaces/IJamBalanceManager.sol#L2) allows old versions

src/interfaces/IJamBalanceManager.sol#L2


 - [ ] ID-105
Pragma version[^0.8.17](src/JamBalanceManager.sol#L2) allows old versions

src/JamBalanceManager.sol#L2


 - [ ] ID-106
Pragma version[^0.8.17](src/libraries/common/BMath.sol#L2) allows old versions

src/libraries/common/BMath.sol#L2


 - [ ] ID-107
Pragma version[^0.8.17](src/libraries/ExecInfo.sol#L2) allows old versions

src/libraries/ExecInfo.sol#L2


 - [ ] ID-108
Pragma version[^0.8.0](src/interfaces/IDaiLikePermit.sol#L2) allows old versions

src/interfaces/IDaiLikePermit.sol#L2


## low-level-calls
Impact: Informational
Confidence: High
 - [ ] ID-109
Low level call in [JamSolver.withdraw(address)](src/JamSolver.sol#L44-L48):
	- [address(receiver).call{value: address(this).balance}()](src/JamSolver.sol#L46)

src/JamSolver.sol#L44-L48


 - [ ] ID-110
Low level call in [JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool)](src/base/JamTransfer.sol#L24-L62):
	- [(sent) = address(receiver).call{value: partialFillAmount_scope_1}()](src/base/JamTransfer.sol#L45)
	- [(sent) = address(receiver).call{value: tokenBalance_scope_0}()](src/base/JamTransfer.sol#L45)

src/base/JamTransfer.sol#L24-L62


 - [ ] ID-111
Low level call in [JamInteraction.execute(JamInteraction.Data)](src/libraries/JamInteraction.sol#L18-L21):
	- [(_result) = address(interaction.to).call{value: interaction.value}(interaction.data)](src/libraries/JamInteraction.sol#L19)

src/libraries/JamInteraction.sol#L18-L21


 - [ ] ID-112
Low level call in [JamSolver.execute(JamInteraction.Data[],address[],uint256[],uint256[],bytes,address)](src/JamSolver.sol#L59-L81):
	- [address(receiver).call{value: outputAmounts[i_scope_0]}()](src/JamSolver.sol#L72)

src/JamSolver.sol#L59-L81


 - [ ] ID-113
Low level call in [JamTransfer.transferNativeFromContract(address,uint256)](src/base/JamTransfer.sol#L67-L70):
	- [(sent) = address(receiver).call{value: amount}()](src/base/JamTransfer.sol#L68)

src/base/JamTransfer.sol#L67-L70


## naming-convention
Impact: Informational
Confidence: High
 - [ ] ID-114
Variable [JamBalanceManager.PERMIT2](src/JamBalanceManager.sol#L25) is not in mixedCase

src/JamBalanceManager.sol#L25


 - [ ] ID-115
Function [JamSigning.DOMAIN_SEPARATOR()](src/base/JamSigning.sol#L44-L50) is not in mixedCase

src/base/JamSigning.sol#L44-L50


 - [ ] ID-116
Variable [JamBalanceManager.DAI_TOKEN](src/JamBalanceManager.sol#L26) is not in mixedCase

src/JamBalanceManager.sol#L26


 - [ ] ID-117
Variable [JamSigning._CACHED_CHAIN_ID](src/base/JamSigning.sol#L33) is not in mixedCase

src/base/JamSigning.sol#L33


 - [ ] ID-118
Variable [JamSigning._CACHED_DOMAIN_SEPARATOR](src/base/JamSigning.sol#L32) is not in mixedCase

src/base/JamSigning.sol#L32


## similar-names
Impact: Informational
Confidence: Medium
 - [ ] ID-119
Variable [JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool).tokenBalance_scope_2](src/base/JamTransfer.sol#L48) is too similar to [JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool).tokenBalance_scope_3](src/base/JamTransfer.sol#L52)

src/base/JamTransfer.sol#L48


 - [ ] ID-120
Variable [JamSolver.execute(JamInteraction.Data[],address[],uint256[],uint256[],bytes,address).token_scope_1](src/JamSolver.sol#L74) is too similar to [JamSolver.execute(JamInteraction.Data[],address[],uint256[],uint256[],bytes,address).token_scope_2](src/JamSolver.sol#L77)

src/JamSolver.sol#L74


 - [ ] ID-121
Variable [JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool).tokenBalance_scope_0](src/base/JamTransfer.sol#L42) is too similar to [JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool).tokenBalance_scope_2](src/base/JamTransfer.sol#L48)

src/base/JamTransfer.sol#L42


 - [ ] ID-122
Variable [JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool).tokenBalance_scope_0](src/base/JamTransfer.sol#L42) is too similar to [JamTransfer.transferTokensFromContract(address[],uint256[],uint256[],bytes,address,uint16,bool).tokenBalance_scope_3](src/base/JamTransfer.sol#L52)

src/base/JamTransfer.sol#L42


## unused-state
Impact: Informational
Confidence: High
 - [ ] ID-123
[JamSolver.NATIVE_TOKEN](src/JamSolver.sol#L20) is never used in [JamSolver](src/JamSolver.sol#L16-L83)

src/JamSolver.sol#L20


## pess-magic-number
Impact: Informational
Confidence: High
 - [ ] ID-124
Function [JamSettlement.settleBatch(JamOrder.Data[],Signature.TypedSignature[],Signature.TakerPermitsInfo[],JamInteraction.Data[],JamHooks.Def[],ExecInfo.BatchSolverData)](src/JamSettlement.sol#L122-L167) contains magic number: 10000

src/JamSettlement.sol#L122-L167


 - [ ] ID-125
Function [JamBalanceManager.permitToken(address,address,uint256,bytes)](src/JamBalanceManager.sol#L182-L201) contains magic number: 137

src/JamBalanceManager.sol#L182-L201


 - [ ] ID-126
Function [JamSigning.invalidateOrderNonce(address,uint256,bool)](src/base/JamSigning.sol#L180-L188) contains magic number: 8

src/base/JamSigning.sol#L180-L188


 - [ ] ID-127
Function [Signature.getRsv(bytes)](src/libraries/Signature.sol#L25-L39) contains magic numbers: 65, 32, 64, 65, 27, 27, 27

src/libraries/Signature.sol#L25-L39


 - [ ] ID-128
Function [JamSigning.validateSignature(address,bytes32,Signature.TypedSignature)](src/base/JamSigning.sol#L105-L134) contains magic number: 28

src/base/JamSigning.sol#L105-L134


 - [ ] ID-129
Function [JamSigning.isLimitOrderNonceValid(address,uint256)](src/base/JamSigning.sol#L170-L174) contains magic number: 8

src/base/JamSigning.sol#L170-L174


## immutable-states
Impact: Optimization
Confidence: High
 - [ ] ID-130
[JamSolver.owner](src/JamSolver.sol#L18) should be immutable 

src/JamSolver.sol#L18


 - [ ] ID-131
[JamSolver.settlement](src/JamSolver.sol#L19) should be immutable 

src/JamSolver.sol#L19


## pess-multiple-storage-read
Impact: Optimization
Confidence: High
 - [ ] ID-132
In a function [JamSettlement.settleBatch(JamOrder.Data[],Signature.TypedSignature[],Signature.TakerPermitsInfo[],JamInteraction.Data[],JamHooks.Def[],ExecInfo.BatchSolverData)](src/JamSettlement.sol#L122-L167) variable [JamSettlement.balanceManager](src/JamSettlement.sol#L25) is read multiple times

src/JamSettlement.sol#L122-L167


