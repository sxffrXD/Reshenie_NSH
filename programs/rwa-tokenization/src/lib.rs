use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("9ftdEgxvkSr2Yn4vmjHpfadHY38i1NgRN3JpAKncjncj");

/// On-chain lifecycle for investor-facing trust (innovation: milestone transparency).
pub const STATUS_ACTIVE: u8 = 0;
pub const STATUS_FUNDED: u8 = 1;
pub const STATUS_COMPLETED: u8 = 2;

#[program]
pub mod rwa_tokenization {
    use super::*;

    /// Create an agricultural RWA project: SPL mint + metadata + full supply in program treasury.
    pub fn create_asset(
        ctx: Context<CreateAsset>,
        name: String,
        description: String,
        total_supply: u64,
        decimals: u8,
        price_per_token_lamports: u64,
    ) -> Result<()> {
        require!(name.len() <= 32, ErrorCode::NameTooLong);
        require!(description.len() <= 200, ErrorCode::DescriptionTooLong);
        require!(total_supply > 0, ErrorCode::ZeroSupply);

        let asset = &mut ctx.accounts.asset;
        let farmer_pk = ctx.accounts.farmer.key();
        let mint_pk = ctx.accounts.mint.key();
        let asset_key = asset.key();

        asset.farmer = farmer_pk;
        asset.mint = mint_pk;
        asset.treasury = ctx.accounts.treasury.key();
        asset.bump = ctx.bumps.asset;
        asset.name = name.clone();
        asset.description = description;
        asset.metadata_uri = String::new();
        asset.total_supply = total_supply;
        asset.sold_amount = 0;
        asset.price_per_token_lamports = price_per_token_lamports;
        asset.decimals = decimals;
        asset.status = STATUS_ACTIVE;

        let bump = asset.bump;
        let seeds: &[&[u8]] = &[b"asset", mint_pk.as_ref(), &[bump]];
        let signer_seeds = &[seeds];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                    authority: asset.to_account_info(),
                },
                signer_seeds,
            ),
            total_supply,
        )?;

        emit!(AssetCreated {
            asset: asset_key,
            farmer: farmer_pk,
            mint: mint_pk,
            name,
            total_supply,
            price_per_token_lamports,
        });

        Ok(())
    }

    /// Farmer pins off-chain verification JSON (IPFS / HTTPS) to the Asset.
    pub fn attach_metadata(ctx: Context<AttachMetadata>, metadata_uri: String) -> Result<()> {
        require!(metadata_uri.len() <= 200, ErrorCode::UriTooLong);
        ctx.accounts.asset.metadata_uri = metadata_uri;
        Ok(())
    }

    /// Farmer updates lifecycle status (Active → Funded → Completed).
    pub fn update_asset_status(ctx: Context<UpdateAssetStatus>, new_status: u8) -> Result<()> {
        require!(new_status <= STATUS_COMPLETED, ErrorCode::InvalidStatus);
        let asset = &mut ctx.accounts.asset;
        let prev = asset.status;
        asset.status = new_status;

        emit!(AssetStatusUpdated {
            asset: asset.key(),
            previous_status: prev,
            new_status,
        });
        Ok(())
    }

    /// Buy fractional tokens: pay SOL to farmer, receive SPL from treasury.
    pub fn purchase_tokens(ctx: Context<PurchaseTokens>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::ZeroAmount);

        {
            let asset = &ctx.accounts.asset;
            require!(asset.status != STATUS_COMPLETED, ErrorCode::OfferingClosed);
            require!(
                ctx.accounts.treasury.amount >= amount,
                ErrorCode::InsufficientTokens
            );

            let remaining_supply = asset
                .total_supply
                .checked_sub(asset.sold_amount)
                .ok_or(ErrorCode::MathOverflow)?;
            require!(amount <= remaining_supply, ErrorCode::InsufficientTokens);
        }

        let asset = &ctx.accounts.asset;
        let cost = amount
            .checked_mul(asset.price_per_token_lamports)
            .ok_or(ErrorCode::MathOverflow)?;
        let buyer_pk = ctx.accounts.buyer.key();

        require_keys_eq!(ctx.accounts.farmer.key(), asset.farmer);

        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.farmer.to_account_info(),
                },
            ),
            cost,
        )?;

        let mint_key = ctx.accounts.mint.key();
        let bump = asset.bump;
        let seeds: &[&[u8]] = &[b"asset", mint_key.as_ref(), &[bump]];
        let signer_seeds = &[seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.treasury.to_account_info(),
                    to: ctx.accounts.buyer_token_account.to_account_info(),
                    authority: ctx.accounts.asset.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        let asset_mut = &mut ctx.accounts.asset;
        asset_mut.sold_amount = asset_mut
            .sold_amount
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;
        require!(
            asset_mut.sold_amount <= asset_mut.total_supply,
            ErrorCode::Oversold
        );

        emit!(TokensPurchased {
            asset: asset_mut.key(),
            buyer: buyer_pk,
            amount,
            cost_lamports: cost,
            sold_amount_after: asset_mut.sold_amount,
        });

        Ok(())
    }

    /// Farmer-only: simulated income / distribution notice.
    pub fn simulate_income_distribution(
        ctx: Context<SimulateIncome>,
        reported_lamports: u64,
        memo: String,
    ) -> Result<()> {
        require!(memo.len() <= 64, ErrorCode::MemoTooLong);

        emit!(IncomeDistributed {
            asset: ctx.accounts.asset.key(),
            farmer: ctx.accounts.asset.farmer,
            reported_lamports,
            memo,
        });
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(name: String, description: String, total_supply: u64, decimals: u8, price_per_token_lamports: u64)]
pub struct CreateAsset<'info> {
    #[account(mut)]
    pub farmer: Signer<'info>,

    #[account(
        init,
        payer = farmer,
        space = 8 + Asset::INIT_SPACE,
        seeds = [b"asset", mint.key().as_ref()],
        bump
    )]
    pub asset: Account<'info, Asset>,

    #[account(
        init,
        payer = farmer,
        mint::decimals = decimals,
        mint::authority = asset,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = farmer,
        associated_token::mint = mint,
        associated_token::authority = asset,
    )]
    pub treasury: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AttachMetadata<'info> {
    pub farmer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"asset", asset.mint.as_ref()],
        bump = asset.bump,
        constraint = farmer.key() == asset.farmer,
    )]
    pub asset: Account<'info, Asset>,
}

#[derive(Accounts)]
pub struct UpdateAssetStatus<'info> {
    pub farmer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"asset", asset.mint.as_ref()],
        bump = asset.bump,
        constraint = farmer.key() == asset.farmer,
    )]
    pub asset: Account<'info, Asset>,
}

#[derive(Accounts)]
pub struct PurchaseTokens<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(mut)]
    pub farmer: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [b"asset", mint.key().as_ref()],
        bump = asset.bump,
    )]
    pub asset: Account<'info, Asset>,

    #[account(mut, constraint = mint.key() == asset.mint)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = treasury.key() == asset.treasury,
        constraint = treasury.mint == mint.key(),
        constraint = treasury.owner == asset.key(),
    )]
    pub treasury: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = buyer_token_account.mint == mint.key(),
        constraint = buyer_token_account.owner == buyer.key(),
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SimulateIncome<'info> {
    pub farmer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"asset", asset.mint.as_ref()],
        bump = asset.bump,
        constraint = farmer.key() == asset.farmer,
    )]
    pub asset: Account<'info, Asset>,
}

#[account]
#[derive(InitSpace)]
pub struct Asset {
    pub farmer: Pubkey,
    pub mint: Pubkey,
    pub treasury: Pubkey,
    pub bump: u8,
    #[max_len(32)]
    pub name: String,
    #[max_len(200)]
    pub description: String,
    #[max_len(200)]
    pub metadata_uri: String,
    pub total_supply: u64,
    pub sold_amount: u64,
    pub price_per_token_lamports: u64,
    pub decimals: u8,
    pub status: u8,
}

#[event]
pub struct AssetCreated {
    pub asset: Pubkey,
    pub farmer: Pubkey,
    pub mint: Pubkey,
    pub name: String,
    pub total_supply: u64,
    pub price_per_token_lamports: u64,
}

#[event]
pub struct AssetStatusUpdated {
    pub asset: Pubkey,
    pub previous_status: u8,
    pub new_status: u8,
}

#[event]
pub struct TokensPurchased {
    pub asset: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
    pub cost_lamports: u64,
    pub sold_amount_after: u64,
}

#[event]
pub struct IncomeDistributed {
    pub asset: Pubkey,
    pub farmer: Pubkey,
    pub reported_lamports: u64,
    pub memo: String,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Name must be 32 characters or less.")]
    NameTooLong,
    #[msg("Description must be 200 characters or less.")]
    DescriptionTooLong,
    #[msg("Total supply must be positive.")]
    ZeroSupply,
    #[msg("Amount must be positive.")]
    ZeroAmount,
    #[msg("Arithmetic overflow.")]
    MathOverflow,
    #[msg("Memo must be 64 characters or less.")]
    MemoTooLong,
    #[msg("Metadata URI must be 200 characters or less.")]
    UriTooLong,
    #[msg("Not enough tokens left in treasury.")]
    InsufficientTokens,
    #[msg("Offering is completed; no further purchases.")]
    OfferingClosed,
    #[msg("Sold amount exceeded total supply.")]
    Oversold,
    #[msg("Invalid status value.")]
    InvalidStatus,
}
