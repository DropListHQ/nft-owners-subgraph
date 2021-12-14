# NftOwners Subgraphs

- ERC721
- ERC1155
- CryptoPunks -> non-standard
- CryptoKitties -> non-standard

More about subgraphs and The Graph protocol you can find [here](https://thegraph.com/docs/introduction).

### Deliverables for the NFT subgraph:


### Get started:

1. install the graph cli with npm:
```npm install -g @graphprotocol/graph-cli```
or with yarn
```yarn global add @graphprotocol/graph-cli```

2. authenticate with the graph studio:
```graph auth  --studio **YOUR_DEPLOY_KEY_HERE**```

3. build the graph
```graph codegen && graph build```

4. deploy to studio
```graph deploy --studio **YOUR_SUBGRAPH_SLUG_NAME_HERE**```

Can also publish to the decentralized network. Publish and curate by staking GRT tokens.

## Useful resources

- [ERC-721 spec](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-721.md)
- [ERC-1155 spec](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1155.md)
