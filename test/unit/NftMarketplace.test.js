const { assert, expect } = require("chai")
const { network, deployments, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("NFT Marketplace Unit Tests", function () {
          let nftMarketplace, basicNft, deployer, player
          const PRICE = ethers.utils.parseEther("0.1")
          const TOKEN_ID = 0
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              //player = (await getNamedAccounts()).player
              const accounts = await ethers.getSigners()
              player = accounts[1]
              await deployments.fixture(["all"])
              nftMarketplace = await ethers.getContract("NftMarketplace")
              basicNft = await ethers.getContract("BasicNft")
              await basicNft.mintNft()
              await basicNft.approve(nftMarketplace.address, TOKEN_ID)
          })

          describe("List and Buy", () => {
              it("Lists and can be bought", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                      value: PRICE,
                  })
                  const newOwner = await basicNft.ownerOf(TOKEN_ID)
                  const deployerProceeds = await nftMarketplace.getProceeds(deployer)
                  assert(newOwner.toString() == player.address)
                  assert(deployerProceeds.toString() == PRICE.toString())
              })
          })

          describe("List Item", () => {
              it("Reverts if listed already", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace__AlreadyListed")
              })
              it("Reverts if not owner", async function () {
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await expect(
                      playerConnectedNftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace__NotOwner")
              })
              it("Reverts if not approved", async function () {
                  await basicNft.approve(player.address, TOKEN_ID)
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace__NotApprovedForMarketplace")
              })
              it("Adds the Listing to s_listings", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert(listing.price.toString() == PRICE)
                  assert(listing.seller.toString() == deployer)
              })
              it("Should emit an event", async function () {
                  await expect(nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)).to.emit(
                      nftMarketplace,
                      "ItemListed"
                  )
              })
          })

          describe("Buy Item", () => {
              it("Reverts if not listed", async function () {
                  await expect(
                      nftMarketplace.buyItem(basicNft.address, TOKEN_ID, { value: PRICE })
                  ).to.be.revertedWith("NftMarketplace__NotListed")
              })
              it("Reverts if value is too low", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await expect(
                      playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                          value: (PRICE - 10).toString(),
                      })
                  ).to.be.revertedWith("NftMarketplace__PriceNotMet")
              })
              it("Seller gets proceeds", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                      value: PRICE,
                  })
                  const proceeds = await nftMarketplace.getProceeds(deployer)
                  assert(proceeds.toString() == PRICE.toString())
              })
              it("Emits Item Bought Event", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await expect(
                      playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                          value: PRICE,
                      })
                  ).to.emit(nftMarketplace, "ItemBought")
              })
          })
          describe("Cancel Listing", () => {
              it("Reverts if not owner", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await expect(
                      playerConnectedNftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NftMarketplace__NotOwner")
              })
              it("Reverts if not listed", async function () {
                  await expect(
                      nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NftMarketplace__NotListed")
              })
              it("Listing is deleted", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await expect(
                      playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                          value: PRICE,
                      })
                  ).to.be.revertedWith("NftMarketplace__NotListed")
              })
              it("Emits event ItemCanceled", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)).to.emit(
                      nftMarketplace,
                      "ItemCanceled"
                  )
              })
          })
          describe("Update Listing", () => {
              it("Reverts if not listed", async function () {
                  await expect(
                      nftMarketplace.updateListing(
                          basicNft.address,
                          TOKEN_ID,
                          (PRICE * 2).toString()
                      )
                  ).to.be.revertedWith("NftMarketplace__NotListed")
              })
              it("Reverts if not owner", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await expect(
                      playerConnectedNftMarketplace.updateListing(
                          basicNft.address,
                          TOKEN_ID,
                          (PRICE * 2).toString()
                      )
                  ).to.be.revertedWith("NftMarketplace__NotOwner")
              })
              it("Price is updated", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await nftMarketplace.updateListing(
                      basicNft.address,
                      TOKEN_ID,
                      (PRICE * 2).toString()
                  )
                  const newPrice = (await nftMarketplace.getListing(basicNft.address, TOKEN_ID))
                      .price
                  assert(newPrice.toString() == (PRICE * 2).toString())
              })
              it("Emits ItemListed", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.updateListing(
                          basicNft.address,
                          TOKEN_ID,
                          (PRICE * 2).toString()
                      )
                  ).to.emit(nftMarketplace, "ItemListed")
              })
          })
          describe("Withdraw", () => {
              it("Reverts if no proceeds", async function () {
                  await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWith(
                      "NftMarketplace__NoProceeds"
                  )
              })
              it("Subtracts from proceeds balance", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                      value: PRICE,
                  })

                  const proceedsBefore = await nftMarketplace.getProceeds(deployer)
                  await nftMarketplace.withdrawProceeds()
                  const proceedsAfter = await nftMarketplace.getProceeds(deployer)
                  assert(proceedsBefore.toString() == PRICE)
                  assert(proceedsAfter.toString() == 0)
              })
              it("Sends the money to the caller", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                      value: PRICE,
                  })

                  const deployerProceedsBefore = await nftMarketplace.getProceeds(deployer)
                  const deployerBalanceBefore = await ethers.provider.getBalance(deployer)
                  const txResponse = await nftMarketplace.withdrawProceeds()
                  const transactionReceipt = await txResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const deployerBalanceAfter = await ethers.provider.getBalance(deployer)

                  assert(
                      deployerBalanceAfter.add(gasCost).toString() ==
                          deployerProceedsBefore.add(deployerBalanceBefore).toString()
                  )
              })
          })
          describe("Get Listing", () => {
              it("Returns the listing", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert(listing.price.toString() == PRICE)
                  assert(listing.seller.toString() == deployer)
              })
          })
          describe("Get Proceeds", () => {
              it("Returns the listing", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const proceedsBefore = await nftMarketplace.getProceeds(deployer)
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                      value: PRICE,
                  })
                  const proceedsAfter = await nftMarketplace.getProceeds(deployer)
                  assert(proceedsBefore.toString() == 0)
                  assert(proceedsAfter.toString() == PRICE)
              })
          })
      })

/*



Get Proceeds
- return proceeds

List item
- revert if listed already !!DONE
- revert if isnt owner !!DONE
- revert if not approved !!DONE
- s_listings should return the listing if successful !!DONE
- ItemListed should be emitted !!DONE

Buy Item
- revert if not listed !! DONE
- revert if value is too low !! DONE
- seller should get proceeds !! DONE
- item bought event !! DONE

Cancel Listing
- revert if not owner !!DONE
- revert if not listed !!DONE
- listing is deleted !!DONE
- emit ItemCanceled !!DONE

Update Listing
- revert if not listed !!DONE
- revert if not owner !!DONE
- price should be updated !!DONE
- enit ItemListed !!DONE

Withdraw
- revert if no proceeds !!DONE
- change proceeds balance !!DONE
- send the money to caller !!DONE

Get Listing
- return listing !! DONE

*/
