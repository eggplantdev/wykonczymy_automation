import * as migration_20260211_202001 from './20260211_202001'
import * as migration_20260211_204911_add_user_role from './20260211_204911_add_user_role'
import * as migration_20260211_212425 from './20260211_212425'
import * as migration_20260211_213603 from './20260211_213603'
import * as migration_20260212_191046_add_deposit_type from './20260212_191046_add_deposit_type'
import * as migration_20260216_add_performance_indexes from './20260216_add_performance_indexes'
import * as migration_20260218_0_transaction_type_enums from './20260218_0_transaction_type_enums'
import * as migration_20260218_add_cash_register_type from './20260218_add_cash_register_type'
import * as migration_20260218_add_investment_financials from './20260218_add_investment_financials'
import * as migration_20260218_rename_advance_to_account_funding from './20260218_rename_advance_to_account_funding'
import * as migration_20260218_seed_other_category_inne from './20260218_seed_other_category_inne'
import * as migration_20260218_transaction_type_overhaul from './20260218_transaction_type_overhaul'
import * as migration_20260219_192300_add_active_field_to_users from './20260219_192300_add_active_field_to_users'
import * as migration_20260220_add_active_field_to_cash_registers from './20260220_add_active_field_to_cash_registers'
import * as migration_20260221_193257 from './20260221_193257'
import * as migration_20260221_200518 from './20260221_200518'
import * as migration_20260221_201040 from './20260221_201040'
import * as migration_20260221_201112 from './20260221_201112'
import * as migration_20260221_add_virtual_cash_register_type from './20260221_add_virtual_cash_register_type'
import * as migration_20260222_rename_cash_register_to_source_register from './20260222_rename_cash_register_to_source_register'
import * as migration_20260222_0_add_cancellation_enum from './20260222_0_add_cancellation_enum'
import * as migration_20260222_1_add_cancellation_columns from './20260222_1_add_cancellation_columns'
import * as migration_20260222_drop_materialized_columns from './20260222_drop_materialized_columns'
import * as migration_20260307_add_labor_cost_type_drop_labor_costs from './20260307_add_labor_cost_type_drop_labor_costs'
import * as migration_20260309_add_expense_categories from './20260309_add_expense_categories'
import * as migration_20260310_fix_locked_docs_expense_categories from './20260310_fix_locked_docs_expense_categories'
import * as migration_20260310_0_add_worker_register_type from './20260310_0_add_worker_register_type'
import * as migration_20260310_workers_as_registers from './20260310_workers_as_registers'
import * as migration_20260312_add_updated_by_to_transactions from './20260312_add_updated_by_to_transactions'
import * as migration_20260325_add_review_to_investments from './20260325_add_review_to_investments'
import * as migration_20260325_add_correction_enum from './20260325_add_correction_enum'
import * as migration_20260407_add_amount_edit_audit from './20260407_add_amount_edit_audit'
import * as migration_20260412_add_amount_trigram_index from './20260412_add_amount_trigram_index'
import * as migration_20260525_add_google_sheet_id_to_investments from './20260525_add_google_sheet_id_to_investments'
import * as migration_20260527_add_unique_google_sheet_id from './20260527_add_unique_google_sheet_id'
import * as migration_20260528_move_sheet_id_to_kosztoryses from './20260528_move_sheet_id_to_kosztoryses'
import * as migration_20260611_add_rabat_enum from './20260611_add_rabat_enum'
import * as migration_20260611_1_add_loss_enum from './20260611_1_add_loss_enum'

export const migrations = [
  {
    up: migration_20260211_202001.up,
    down: migration_20260211_202001.down,
    name: '20260211_202001',
  },
  {
    up: migration_20260211_204911_add_user_role.up,
    down: migration_20260211_204911_add_user_role.down,
    name: '20260211_204911_add_user_role',
  },
  {
    up: migration_20260211_212425.up,
    down: migration_20260211_212425.down,
    name: '20260211_212425',
  },
  {
    up: migration_20260211_213603.up,
    down: migration_20260211_213603.down,
    name: '20260211_213603',
  },
  {
    up: migration_20260212_191046_add_deposit_type.up,
    down: migration_20260212_191046_add_deposit_type.down,
    name: '20260212_191046_add_deposit_type',
  },
  {
    up: migration_20260216_add_performance_indexes.up,
    down: migration_20260216_add_performance_indexes.down,
    name: '20260216_add_performance_indexes',
  },
  {
    up: migration_20260218_0_transaction_type_enums.up,
    down: migration_20260218_0_transaction_type_enums.down,
    name: '20260218_0_transaction_type_enums',
  },
  {
    up: migration_20260218_add_cash_register_type.up,
    down: migration_20260218_add_cash_register_type.down,
    name: '20260218_add_cash_register_type',
  },
  {
    up: migration_20260218_add_investment_financials.up,
    down: migration_20260218_add_investment_financials.down,
    name: '20260218_add_investment_financials',
  },
  {
    up: migration_20260218_rename_advance_to_account_funding.up,
    down: migration_20260218_rename_advance_to_account_funding.down,
    name: '20260218_rename_advance_to_account_funding',
  },
  {
    up: migration_20260218_seed_other_category_inne.up,
    down: migration_20260218_seed_other_category_inne.down,
    name: '20260218_seed_other_category_inne',
  },
  {
    up: migration_20260218_transaction_type_overhaul.up,
    down: migration_20260218_transaction_type_overhaul.down,
    name: '20260218_transaction_type_overhaul',
  },
  {
    up: migration_20260219_192300_add_active_field_to_users.up,
    down: migration_20260219_192300_add_active_field_to_users.down,
    name: '20260219_192300_add_active_field_to_users',
  },
  {
    up: migration_20260220_add_active_field_to_cash_registers.up,
    down: migration_20260220_add_active_field_to_cash_registers.down,
    name: '20260220_add_active_field_to_cash_registers',
  },
  {
    up: migration_20260221_193257.up,
    down: migration_20260221_193257.down,
    name: '20260221_193257',
  },
  {
    up: migration_20260221_200518.up,
    down: migration_20260221_200518.down,
    name: '20260221_200518',
  },
  {
    up: migration_20260221_201040.up,
    down: migration_20260221_201040.down,
    name: '20260221_201040',
  },
  {
    up: migration_20260221_201112.up,
    down: migration_20260221_201112.down,
    name: '20260221_201112',
  },
  {
    up: migration_20260221_add_virtual_cash_register_type.up,
    down: migration_20260221_add_virtual_cash_register_type.down,
    name: '20260221_add_virtual_cash_register_type',
  },
  {
    up: migration_20260222_rename_cash_register_to_source_register.up,
    down: migration_20260222_rename_cash_register_to_source_register.down,
    name: '20260222_rename_cash_register_to_source_register',
  },
  {
    up: migration_20260222_0_add_cancellation_enum.up,
    down: migration_20260222_0_add_cancellation_enum.down,
    name: '20260222_0_add_cancellation_enum',
  },
  {
    up: migration_20260222_1_add_cancellation_columns.up,
    down: migration_20260222_1_add_cancellation_columns.down,
    name: '20260222_1_add_cancellation_columns',
  },
  {
    up: migration_20260222_drop_materialized_columns.up,
    down: migration_20260222_drop_materialized_columns.down,
    name: '20260222_drop_materialized_columns',
  },
  {
    up: migration_20260307_add_labor_cost_type_drop_labor_costs.up,
    down: migration_20260307_add_labor_cost_type_drop_labor_costs.down,
    name: '20260307_add_labor_cost_type_drop_labor_costs',
  },
  {
    up: migration_20260309_add_expense_categories.up,
    down: migration_20260309_add_expense_categories.down,
    name: '20260309_add_expense_categories',
  },
  {
    up: migration_20260310_fix_locked_docs_expense_categories.up,
    down: migration_20260310_fix_locked_docs_expense_categories.down,
    name: '20260310_fix_locked_docs_expense_categories',
  },
  {
    up: migration_20260310_0_add_worker_register_type.up,
    down: migration_20260310_0_add_worker_register_type.down,
    name: '20260310_0_add_worker_register_type',
  },
  {
    up: migration_20260310_workers_as_registers.up,
    down: migration_20260310_workers_as_registers.down,
    name: '20260310_workers_as_registers',
  },
  {
    up: migration_20260312_add_updated_by_to_transactions.up,
    down: migration_20260312_add_updated_by_to_transactions.down,
    name: '20260312_add_updated_by_to_transactions',
  },
  {
    up: migration_20260325_add_review_to_investments.up,
    down: migration_20260325_add_review_to_investments.down,
    name: '20260325_add_review_to_investments',
  },
  {
    up: migration_20260325_add_correction_enum.up,
    down: migration_20260325_add_correction_enum.down,
    name: '20260325_add_correction_enum',
  },
  {
    up: migration_20260407_add_amount_edit_audit.up,
    down: migration_20260407_add_amount_edit_audit.down,
    name: '20260407_add_amount_edit_audit',
  },
  {
    up: migration_20260412_add_amount_trigram_index.up,
    down: migration_20260412_add_amount_trigram_index.down,
    name: '20260412_add_amount_trigram_index',
  },
  {
    up: migration_20260525_add_google_sheet_id_to_investments.up,
    down: migration_20260525_add_google_sheet_id_to_investments.down,
    name: '20260525_add_google_sheet_id_to_investments',
  },
  {
    up: migration_20260527_add_unique_google_sheet_id.up,
    down: migration_20260527_add_unique_google_sheet_id.down,
    name: '20260527_add_unique_google_sheet_id',
  },
  {
    up: migration_20260528_move_sheet_id_to_kosztoryses.up,
    down: migration_20260528_move_sheet_id_to_kosztoryses.down,
    name: '20260528_move_sheet_id_to_kosztoryses',
  },
  {
    up: migration_20260611_add_rabat_enum.up,
    down: migration_20260611_add_rabat_enum.down,
    name: '20260611_add_rabat_enum',
  },
  {
    up: migration_20260611_1_add_loss_enum.up,
    down: migration_20260611_1_add_loss_enum.down,
    name: '20260611_1_add_loss_enum',
  },
]
