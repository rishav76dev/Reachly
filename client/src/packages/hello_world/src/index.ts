import { Buffer } from "buffer";
import {
  AssembledTransaction,
  Client as ContractClient,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  u64,
  i128,
  ClientOptions as ContractClientOptions,
  MethodOptions,
} from "@stellar/stellar-sdk/contract";
export { Address, Keypair, StrKey, TransactionBuilder, xdr } from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CAMYKXOLIIO6B3XKMQOSU7U3F5FPMGHH2TTGOT33OVG2J5F62UMRQGGR",
  }
} as const

export const Errors = {
  1: {message:"BudgetMustBePositive"},
  2: {message:"DurationMustBePositive"},
  3: {message:"CampaignDoesNotExist"},
  4: {message:"CampaignEnded"},
  5: {message:"CampaignStillActive"},
  6: {message:"ResultsAlreadyFinalized"},
  7: {message:"InvalidSubmissionIndex"},
  8: {message:"NoViewsRecorded"},
  9: {message:"ResultsNotFinalized"},
  10: {message:"OnlyCreatorCanClaim"},
  11: {message:"RewardAlreadyClaimed"},
  12: {message:"NoRewardToClaim"},
  13: {message:"ViewsCannotDecrease"}
}


export interface Campaign {
  brand: string;
  deadline: u64;
  name: string;
  results_finalized: boolean;
  submissions: Array<Submission>;
  token: string;
  total_budget: i128;
  total_views: u64;
}


export interface Submission {
  creator: string;
  link: string;
  paid: boolean;
  reward: i128;
  views: u64;
}

export interface Client {
  /**
   * Construct and simulate a submit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  submit: ({campaign_id, creator, link}: {campaign_id: u32, creator: string, link: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_views transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_views: ({campaign_id, index, views}: {campaign_id: u32, index: u32, views: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a claim_reward transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  claim_reward: ({campaign_id, index, creator}: {campaign_id: u32, index: u32, creator: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_campaign transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_campaign: ({campaign_id}: {campaign_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Campaign>>

  /**
   * Construct and simulate a get_submission transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_submission: ({campaign_id, index}: {campaign_id: u32, index: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Submission>>

  /**
   * Construct and simulate a create_campaign transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_campaign: ({name, brand, token_address, duration, total_budget}: {name: string, brand: string, token_address: string, duration: u64, total_budget: i128}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a finalize_results transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  finalize_results: ({campaign_id}: {campaign_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_campaign_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_campaign_count: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_submission_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_submission_count: ({campaign_id}: {campaign_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

}
export class Client extends ContractClient {
  public readonly options: ContractClientOptions;

  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAADQAAAAAAAAAUQnVkZ2V0TXVzdEJlUG9zaXRpdmUAAAABAAAAAAAAABZEdXJhdGlvbk11c3RCZVBvc2l0aXZlAAAAAAACAAAAAAAAABRDYW1wYWlnbkRvZXNOb3RFeGlzdAAAAAMAAAAAAAAADUNhbXBhaWduRW5kZWQAAAAAAAAEAAAAAAAAABNDYW1wYWlnblN0aWxsQWN0aXZlAAAAAAUAAAAAAAAAF1Jlc3VsdHNBbHJlYWR5RmluYWxpemVkAAAAAAYAAAAAAAAAFkludmFsaWRTdWJtaXNzaW9uSW5kZXgAAAAAAAcAAAAAAAAAD05vVmlld3NSZWNvcmRlZAAAAAAIAAAAAAAAABNSZXN1bHRzTm90RmluYWxpemVkAAAAAAkAAAAAAAAAE09ubHlDcmVhdG9yQ2FuQ2xhaW0AAAAACgAAAAAAAAAUUmV3YXJkQWxyZWFkeUNsYWltZWQAAAALAAAAAAAAAA9Ob1Jld2FyZFRvQ2xhaW0AAAAADAAAAAAAAAATVmlld3NDYW5ub3REZWNyZWFzZQAAAAAN",
        "AAAAAQAAAAAAAAAAAAAACENhbXBhaWduAAAACAAAAAAAAAAFYnJhbmQAAAAAAAATAAAAAAAAAAhkZWFkbGluZQAAAAYAAAAAAAAABG5hbWUAAAAQAAAAAAAAABFyZXN1bHRzX2ZpbmFsaXplZAAAAAAAAAEAAAAAAAAAC3N1Ym1pc3Npb25zAAAAA+oAAAfQAAAAClN1Ym1pc3Npb24AAAAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAAx0b3RhbF9idWRnZXQAAAALAAAAAAAAAAt0b3RhbF92aWV3cwAAAAAG",
        "AAAAAQAAAAAAAAAAAAAAClN1Ym1pc3Npb24AAAAAAAUAAAAAAAAAB2NyZWF0b3IAAAAAEwAAAAAAAAAEbGluawAAABAAAAAAAAAABHBhaWQAAAABAAAAAAAAAAZyZXdhcmQAAAAAAAsAAAAAAAAABXZpZXdzAAAAAAAABg==",
        "AAAAAAAAAAAAAAAGc3VibWl0AAAAAAADAAAAAAAAAAtjYW1wYWlnbl9pZAAAAAAEAAAAAAAAAAdjcmVhdG9yAAAAABMAAAAAAAAABGxpbmsAAAAQAAAAAA==",
        "AAAAAAAAAAAAAAAJc2V0X3ZpZXdzAAAAAAAAAwAAAAAAAAALY2FtcGFpZ25faWQAAAAABAAAAAAAAAAFaW5kZXgAAAAAAAAEAAAAAAAAAAV2aWV3cwAAAAAAAAYAAAAA",
        "AAAAAAAAAAAAAAAMY2xhaW1fcmV3YXJkAAAAAwAAAAAAAAALY2FtcGFpZ25faWQAAAAABAAAAAAAAAAFaW5kZXgAAAAAAAAEAAAAAAAAAAdjcmVhdG9yAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAMZ2V0X2NhbXBhaWduAAAAAQAAAAAAAAALY2FtcGFpZ25faWQAAAAABAAAAAEAAAfQAAAACENhbXBhaWdu",
        "AAAAAAAAAAAAAAAOZ2V0X3N1Ym1pc3Npb24AAAAAAAIAAAAAAAAAC2NhbXBhaWduX2lkAAAAAAQAAAAAAAAABWluZGV4AAAAAAAABAAAAAEAAAfQAAAAClN1Ym1pc3Npb24AAA==",
        "AAAAAAAAAAAAAAAPY3JlYXRlX2NhbXBhaWduAAAAAAUAAAAAAAAABG5hbWUAAAAQAAAAAAAAAAVicmFuZAAAAAAAABMAAAAAAAAADXRva2VuX2FkZHJlc3MAAAAAAAATAAAAAAAAAAhkdXJhdGlvbgAAAAYAAAAAAAAADHRvdGFsX2J1ZGdldAAAAAsAAAABAAAABA==",
        "AAAAAAAAAAAAAAAQZmluYWxpemVfcmVzdWx0cwAAAAEAAAAAAAAAC2NhbXBhaWduX2lkAAAAAAQAAAAA",
        "AAAAAAAAAAAAAAASZ2V0X2NhbXBhaWduX2NvdW50AAAAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAUZ2V0X3N1Ym1pc3Npb25fY291bnQAAAABAAAAAAAAAAtjYW1wYWlnbl9pZAAAAAAEAAAAAQAAAAQ=" ]),
      options
    )
    this.options = options;
  }
  public readonly fromJSON = {
    submit: this.txFromJSON<null>,
        set_views: this.txFromJSON<null>,
        claim_reward: this.txFromJSON<null>,
        get_campaign: this.txFromJSON<Campaign>,
        get_submission: this.txFromJSON<Submission>,
        create_campaign: this.txFromJSON<u32>,
        finalize_results: this.txFromJSON<null>,
        get_campaign_count: this.txFromJSON<u32>,
        get_submission_count: this.txFromJSON<u32>
  }
}