import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.2/index.ts';
import { assertEquals } from 'https://deno.land/std@0.170.0/testing/asserts.ts';

interface NetworkDetails {
  name: string;
  location: string;
  'total-devices': bigint;
  owner: string;
}

function parseNetworkDetails(details: any): NetworkDetails {
  if (typeof details === 'object' && details !== null) {
    return {
      name: details.name || '',
      location: details.location || '',
      'total-devices': details['total-devices'] || 0n,
      owner: details.owner || ''
    };
  }
  throw new Error('Invalid network details format')
}

Clarinet.test({
  name: "Successful network registration",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    
    const block = chain.mineBlock([
      Tx.contractCall(
        "light_network_registry", 
        "register-network", 
        [
          types.ascii("TestNet"),   // name
          types.ascii("Test Location"),  // location 
          types.uint(10)  // total devices
        ], 
        deployer.address
      )
    ]);

    // Verify registration succeeded
    block.receipts[0].result.expectOk().expectPrincipal(deployer.address);

    // Verify network details can be retrieved
    const networkDetails = chain.callReadOnlyFn(
      "light_network_registry", 
      "get-network-details", 
      [types.principal(deployer.address)], 
      deployer.address
    );

    networkDetails.result.expectSome();
    const details = parseNetworkDetails(networkDetails.result.expectSome());
    
    assertEquals(details.name, "TestNet");
    assertEquals(details.location, "Test Location");
    assertEquals(details['total-devices'], 10n);
    assertEquals(details.owner, deployer.address);

    // Verify total networks count
    const totalNetworks = chain.callReadOnlyFn(
      "light_network_registry", 
      "get-total-networks", 
      [], 
      deployer.address
    );
    totalNetworks.result.expectUint(1);
  },
});

Clarinet.test({
  name: "Prevent invalid network names",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    
    // Test empty name
    const emptyNameBlock = chain.mineBlock([
      Tx.contractCall(
        "light_network_registry", 
        "register-network", 
        [
          types.ascii(""),   // empty name
          types.ascii("Test Location"),  
          types.uint(10)
        ], 
        deployer.address
      )
    ]);
    emptyNameBlock.receipts[0].result.expectErr().expectUint(400);

    // Test extremely long name (over 50 chars)
    const longNameBlock = chain.mineBlock([
      Tx.contractCall(
        "light_network_registry", 
        "register-network", 
        [
          types.ascii("ThisIsAnExtremelyLongNetworkNameThatExceedsTheFiftyCharacterLimit"),   
          types.ascii("Test Location"),  
          types.uint(10)
        ], 
        deployer.address
      )
    ]);
    longNameBlock.receipts[0].result.expectErr().expectUint(400);
  },
});

Clarinet.test({
  name: "Prevent duplicate network registration",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    
    // First registration
    const firstRegistration = chain.mineBlock([
      Tx.contractCall(
        "light_network_registry", 
        "register-network", 
        [
          types.ascii("UniqueNet"),   
          types.ascii("Test Location"),  
          types.uint(10)
        ], 
        deployer.address
      )
    ]);
    firstRegistration.receipts[0].result.expectOk();

    // Attempt to register again with same network ID
    const duplicateRegistration = chain.mineBlock([
      Tx.contractCall(
        "light_network_registry", 
        "register-network", 
        [
          types.ascii("DuplicateNet"),   
          types.ascii("Another Location"),  
          types.uint(5)
        ], 
        deployer.address
      )
    ]);
    duplicateRegistration.receipts[0].result.expectErr().expectUint(409);
  },
});

Clarinet.test({
  name: "Network update by owner",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    
    // First register the network
    const registration = chain.mineBlock([
      Tx.contractCall(
        "light_network_registry", 
        "register-network", 
        [
          types.ascii("UpdateNet"),   
          types.ascii("Initial Location"),  
          types.uint(10)
        ], 
        deployer.address
      )
    ]);
    registration.receipts[0].result.expectOk();

    // Update network by owner
    const updateBlock = chain.mineBlock([
      Tx.contractCall(
        "light_network_registry", 
        "update-network", 
        [
          types.ascii("UpdatedNet"),   
          types.ascii("Updated Location"),  
          types.uint(20)
        ], 
        deployer.address
      )
    ]);
    updateBlock.receipts[0].result.expectOk();

    // Verify updated details
    const networkDetails = chain.callReadOnlyFn(
      "light_network_registry", 
      "get-network-details", 
      [types.principal(deployer.address)], 
      deployer.address
    );

    const details = networkDetails.result.expectSome();
    assertEquals((details as { name: string }).name, "UpdatedNet");
    assertEquals((details as { location: string }).location, "Updated Location");
    assertEquals((details as { 'total-devices': bigint })['total-devices'], 20n);
  },
});

Clarinet.test({
  name: "Prevent network update by non-owner",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;
    
    // Register network
    const registration = chain.mineBlock([
      Tx.contractCall(
        "light_network_registry", 
        "register-network", 
        [
          types.ascii("SecureNet"),   
          types.ascii("Initial Location"),  
          types.uint(10)
        ], 
        deployer.address
      )
    ]);
    registration.receipts[0].result.expectOk();

    // Attempt update by different account
    const updateBlock = chain.mineBlock([
      Tx.contractCall(
        "light_network_registry", 
        "update-network", 
        [
          types.ascii("UnauthorizedUpdate"),   
          types.ascii("Unauthorized Location"),  
          types.uint(20)
        ], 
        wallet1.address
      )
    ]);
    updateBlock.receipts[0].result.expectErr().expectUint(403);
  },
});

Clarinet.test({
  name: "Test network existence check",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;
    
    // Before registration
    const beforeRegistration = chain.callReadOnlyFn(
      "light_network_registry", 
      "network-exists", 
      [types.principal(deployer.address)], 
      deployer.address
    );
    beforeRegistration.result.expectBool(false);

    // Register network
    const registration = chain.mineBlock([
      Tx.contractCall(
        "light_network_registry", 
        "register-network", 
        [
          types.ascii("ExistenceNet"),   
          types.ascii("Test Location"),  
          types.uint(10)
        ], 
        deployer.address
      )
    ]);
    registration.receipts[0].result.expectOk();

    // After registration
    const afterRegistration = chain.callReadOnlyFn(
      "light_network_registry", 
      "network-exists", 
      [types.principal(deployer.address)], 
      deployer.address
    );
    afterRegistration.result.expectBool(true);

    // Check for non-registered network
    const nonExistentCheck = chain.callReadOnlyFn(
      "light_network_registry", 
      "network-exists", 
      [types.principal(wallet1.address)], 
      deployer.address
    );
    nonExistentCheck.result.expectBool(false);
  },
});

Clarinet.test({
  name: "Retrieve network details",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    
    // Register network
    const registration = chain.mineBlock([
      Tx.contractCall(
        "light_network_registry", 
        "register-network", 
        [
          types.ascii("DetailNet"),   
          types.ascii("Detailed Location"),  
          types.uint(15)
        ], 
        deployer.address
      )
    ]);
    registration.receipts[0].result.expectOk();

    // Retrieve network details
    const networkDetails = chain.callReadOnlyFn(
      "light_network_registry", 
      "get-network-details", 
      [types.principal(deployer.address)], 
      deployer.address
    );

    const details = networkDetails.result.expectSome();
    assertEquals((details as { name: string }).name, "DetailNet");
    assertEquals((details as { location: string }).location, "Detailed Location");
    assertEquals((details as { 'total-devices': bigint })['total-devices'], 15n);
    assertEquals((details as { owner: string }).owner, deployer.address);

    // Check non-existent network details
    const wallet1 = accounts.get("wallet_1")!;
    const nonExistentDetails = chain.callReadOnlyFn(
      "light_network_registry", 
      "get-network-details", 
      [types.principal(wallet1.address)], 
      deployer.address
    );
    nonExistentDetails.result.expectNone();
  },
});