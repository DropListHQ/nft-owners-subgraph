import { ERC721, Transfer } from '../generated/templates/NftContract/ERC721'
import { Nft, NftContract } from '../generated/schema'
import {
  fetchName,
  fetchSymbol,
  handleTransfer,
  supportsInterfaceErc721
} from './mapping'
import { ZERO_ADDRESS, BIGINT_ZERO } from './constants'
import { Address, BigInt, log } from '@graphprotocol/graph-ts'

export function handleTransferErc721 (event: Transfer): void {
  let address = event.address.toHexString()

  if (NftContract.load(address) == null) {
    let contract = ERC721.bind(event.address)
    let supportsEIP165Identifier = supportsInterfaceErc721(contract, '01ffc9a7')
    let supportsEIP721Identifier = supportsInterfaceErc721(contract, '80ac58cd')
    let supportsNullIdentifierFalse = supportsInterfaceErc721(
      contract,
      '00000000',
      false
    )
    let supportsEIP721 =
      supportsEIP165Identifier &&
      supportsEIP721Identifier &&
      supportsNullIdentifierFalse

    let supportsEIP721Metadata = false
    if (supportsEIP721) {
      supportsEIP721Metadata = supportsInterfaceErc721(contract, '5b5e139f')
    }
    if (!supportsEIP721) {
      return
    }

    let nftContract = new NftContract(address)
    nftContract.name = fetchName(event.address)
    nftContract.symbol = fetchSymbol(event.address)
    nftContract.type = 'ERC721'
    nftContract.numTokens = BIGINT_ZERO;
    nftContract.numOwners = BIGINT_ZERO;
    nftContract.save()
  }

  handleTransfer(event)

  let id = address + '/' + event.params.tokenId.toString()
  let nft = Nft.load(id)
  if (nft.creatorAddress == null) {
    nft.creatorAddress = event.params.to
    nft.save()
  }
}
