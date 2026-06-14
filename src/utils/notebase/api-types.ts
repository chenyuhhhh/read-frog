import type {
  ColumnCreateInput,
  CustomTableCreateInput,
  CustomTableGetSchemaOutput,
  CustomTableListOutput,
  RowCreateInput,
  TableColumn,
} from "@read-frog/api-contract"
import type { ColumnConfig } from "@read-frog/definitions"

export type NotebaseColumn = TableColumn
export type NotebaseColumnConfig = ColumnConfig
export type NotebaseColumnCreateInput = ColumnCreateInput
export type NotebaseCreateInput = CustomTableCreateInput
export type NotebaseGetSchemaOutput = CustomTableGetSchemaOutput
export type NotebaseListOutput = CustomTableListOutput
export type NotebaseRowCreateInput = RowCreateInput
