import { Address } from '@graphprotocol/graph-ts'
import {
  TransferSingle,
  TransferBatch,
  ERC1155
} from '../generated/ERC1155/ERC1155'
import { NftContract } from '../generated/schema'
import { BIGINT_ZERO } from './constants'
import { fetchName, fetchSymbol } from './mapping'
import {
  handleTransferBatch,
  handleTransferSingle,
  handleURI,
  supportsInterfaceErc1155
} from './mappings-erc-1155'

export { handleURI }

export function handleTransferSingleErc1155 (event: TransferSingle): void {
  if (
    NftContract.load(event.address.toHexString()) == null &&
    !supportsInterfaceErc1155(ERC1155.bind(event.address), 'd9b67a26')
  ) {
    return
  }

  ensureNftContract(event.address)
  handleTransferSingle(event)
}

export function handleTransferBatchErc1155 (event: TransferBatch): void {
  if (
    NftContract.load(event.address.toHexString()) == null &&
    !supportsInterfaceErc1155(ERC1155.bind(event.address), 'd9b67a26')
  ) {
    return
  }

  ensureNftContract(event.address)
  handleTransferBatch(event)
}

function ensureNftContract (address: Address): void {
  if (NftContract.load(address.toHexString()) == null) {
    let nftContract = new NftContract(address.toHexString())
    nftContract.name = fetchName(address)
    nftContract.symbol = fetchSymbol(address)
    nftContract.type = 'ERC1155'
    nftContract.numTokens = BIGINT_ZERO;
    nftContract.numOwners = BIGINT_ZERO;
    nftContract.save()
  }
}
