# Requirements Document: Storage Backend Abstraction

## Introduction

O Expense Tracker atualmente salva todos os dados em um único blob JSON no localStorage do navegador sob a chave `expense_tracker_data_v2`. Esta abordagem tem limitações: não suporta sincronização na nuvem, não é robusta contra perda de dados, e não permite acesso multi-dispositivo.

Este documento define os requisitos para abstrair a camada de persistência através de um padrão de Adapter, permitindo alternar entre localStorage e Firebase Firestore via variável de ambiente. A mudança deve ser transparente para o usuário final e manter a integridade dos dados existentes.

A arquitetura proposta introduz: uma interface `StorageAdapter`, duas implementações (`LocalStorageAdapter` e `FirebaseAdapter`), uma fábrica (`StorageFactory`) para seleção, repositories por entidade, e a modificação do `ExpenseContext` para usar a nova camada.

## Glossary

- **StorageAdapter**: Interface que define o contrato comum para operações de armazenamento (load, save, delete) com métodos assíncronos.
- **LocalStorageAdapter**: Implementação do StorageAdapter que usa o `localStorage` do navegador como backend.
- **FirebaseAdapter**: Implementação do StorageAdapter que usa o Firebase Firestore como backend.
- **StorageFactory**: Classe responsável por instanciar o adapter correto com base na variável de ambiente.
- **Repository**: Camada que encapsula operações de domínio por entidade (BudgetRepository, ExpenseRepository), delegando para o StorageAdapter.
- **StorageData**: Estrutura de dados que contém budgets, expenses e activeBudgetId, representando o estado completo da aplicação.
- **BudgetGoal**: Entidade que representa um orçamento com nome, valor total, datas de início/fim e limites por categoria.
- **Expense**: Entidade que representa uma despesa com valor, descrição, data, categoria e referência ao budget.
- **CategoryLimit**: Estrutura que define o valor máximo permitido para uma categoria dentro de um BudgetGoal.
- **Optimistic Update**: Padrão onde o estado da UI é atualizado imediatamente antes da confirmação do backend, com rollback em caso de falha.
- **Debounce**: Técnica que atrasa a execução de uma operação para agrupar múltiplas chamadas rápidas em uma única execução.
- **Firestore**: Banco de dados NoSQL em tempo real do Firebase, organizado em collections e documents.
- **VITE_STORAGE_BACKEND**: Variável de ambiente do Vite que controla qual backend de armazenamento usar ("local" ou "firebase").

## Requirements

### Requirement 1: StorageAdapter Interface Definition

**User Story:**

Como desenvolvedor, quero definir uma interface StorageAdapter com operações assíncronas para padronizar o contrato de persistência.

1. O sistema DEVE definir uma interface `StorageAdapter` com métodos que retornam `Promise`.
2. A interface DEVE incluir operações por entidade: `loadBudgets()`, `saveBudget()`, `deleteBudget()`, `loadExpenses()`, `saveExpense()`, `updateExpense()`, `deleteExpense()`, `deleteExpensesByBudget()`.
3. A interface DEVE incluir operações de metadados: `getActiveBudgetId()`, `setActiveBudgetId()`.
4. A interface DEVE incluir operações em massa: `loadAll()`, `saveAll()`.
5. Dado qualquer implementação de `StorageAdapter`, quando `loadAll()` é chamado, então retorna um `StorageData` com `budgets`, `expenses`, e `activeBudgetId`.
6. Dado uma despesa válida, quando `saveExpense()` é chamado, então a despesa é persistida e `loadExpenses()` retorna a despesa.
7. Dado um ID de budget, quando `deleteBudget()` é chamado, então `loadBudgets()` não contém o budget.

### Requirement 2: LocalStorageAdapter Implementation

**User Story:**

Como desenvolvedor, quero implementar o LocalStorageAdapter que mantém compatibilidade com o formato de dados atual do localStorage.

1. O sistema DEVE implementar `LocalStorageAdapter` que usa `localStorage` como backend.
2. O adapter DEVE manter compatibilidade com a chave existente `expense_tracker_data_v2`.
3. O adapter DEVE tratar erros de `JSON.parse` graciosamente, retornando dados vazios em caso de dados corrompidos.
4. Dado dados existentes no localStorage sob a chave `expense_tracker_data_v2`, quando `loadAll()` é chamado, então retorna os dados no formato `StorageData`.
5. Dado localStorage com JSON corrompido, quando `loadAll()` é chamado, então retorna `{ budgets: [], expenses: [], activeBudgetId: null }` sem lançar erro.
6. Dado um budget válido, quando `saveBudget()` é chamado, então o budget aparece no JSON em `localStorage.getItem('expense_tracker_data_v2')`.

### Requirement 3: FirebaseAdapter Implementation

**User Story:**

Como desenvolvedor, quero implementar o FirebaseAdapter que usa Firestore como backend de persistência.

1. O sistema DEVE implementar `FirebaseAdapter` que usa Firestore como backend.
2. Budgets DEVE ser armazenados na collection `budgets` com document ID = `budget.id`.
3. Expenses DEVE ser armazenados na collection `expenses` com document ID = `expense.id`.
4. O `activeBudgetId` DEVE ser armazenado no documento `metadata/activeBudget`.
5. O `deleteExpensesByBudget()` DEVE buscar todas as despesas com o `budgetId` especificado e deletá-las.
6. O adapter DEVE tratar erros de rede e permissão propagando a Promise rejeitada com mensagem descritiva.
7. A operação `deleteExpensesByBudget()` DEVE rejeitar ou repetir até que nenhuma despesa com o `budgetId` permaneça; deleção parcial não é aceitável como sucesso.
8. Dado um Firebase inicializado com credenciais válidas, quando `saveBudget(budget)` é chamado, então o documento `budgets/{budget.id}` existe no Firestore.
9. Dado expenses com `budgetId = "abc"`, quando `deleteExpensesByBudget("abc")` é chamado, então nenhuma despesa com `budgetId = "abc"` existe no Firestore; se alguma permanecer, a operação é tratada como falha e deve rejeitar ou repetir.
10. Dado Firestore indisponível, quando `saveExpense()` é chamado, então a Promise é rejeitada com erro descritivo.

### Requirement 4: StorageFactory Selection

**User Story:**

Como desenvolvedor, quero uma StorageFactory que selecione o backend de armazenamento com base em variável de ambiente.

1. O sistema DEVE implementar `StorageFactory.create()` que retorna o adapter apropriado.
2. A seleção DEVE ser baseada na variável de ambiente `VITE_STORAGE_BACKEND`.
3. O valor `"firebase"` DEVE retornar `FirebaseAdapter`.
4. O valor `"local"` DEVE retornar `LocalStorageAdapter`.
5. Se a variável não estiver definida, o sistema DEVE usar `LocalStorageAdapter` como padrão.
6. Se a variável tiver um valor desconhecido, o sistema DEVE lançar um erro descritivo.
7. Dado `VITE_STORAGE_BACKEND = "firebase"`, quando `StorageFactory.create()` é chamado, então retorna uma instância de `FirebaseAdapter`.
8. Dado `VITE_STORAGE_BACKEND = "local"`, quando `StorageFactory.create()` é chamado, então retorna uma instância de `LocalStorageAdapter`.
9. Dado `VITE_STORAGE_BACKEND` indefinido, quando `StorageFactory.create()` é chamado, então retorna uma instância de `LocalStorageAdapter`.
10. Dado `VITE_STORAGE_BACKEND = "invalid"`, quando `StorageFactory.create()` é chamado, então lança erro "Unknown storage backend: invalid".

### Requirement 5: Budget and Expense Repositories

**User Story:**

Como desenvolvedor, quero repositories (BudgetRepository, ExpenseRepository) que encapsulam as operações de domínio por entidade.

1. O sistema DEVE implementar `BudgetRepository` com métodos: `getAll()`, `save()`, `delete()`, `saveAll()`.
2. O sistema DEVE implementar `ExpenseRepository` com métodos: `getAll()`, `save()`, `update()`, `delete()`, `deleteByBudgetId()`.
3. Os repositories DEVE delegar todas as operações para o `StorageAdapter` injetado.
4. Dado um `BudgetRepository` com adapter mockado, quando `getAll()` é chamado, então delega para `adapter.loadBudgets()`.
5. Dado um `ExpenseRepository`, quando `deleteByBudgetId("abc")` é chamado, então delega para `adapter.deleteExpensesByBudget("abc")`.

### Requirement 6: ExpenseContext Integration

**User Story:**

Como desenvolvedor, quero modificar o ExpenseContext para usar a nova camada de storage em vez de acessar localStorage diretamente.

1. O `ExpenseContext` DEVE usar o `StorageAdapter` via repositories em vez de acessar `localStorage` diretamente.
2. O `ExpenseContext` DEVE criar o adapter e repositories uma única vez via `useMemo`.
3. O carregamento inicial DEVE usar `adapter.loadAll()` em vez de `localStorage.getItem()`.
4. As operações de escrita (`addExpense`, `setBudgetGoal`, `deleteBudget`, `updateExpense`, `setActiveBudget`, `setCategoryLimit`) DEVE persistir via repository/adapter.
5. O `ExpenseContext` DEVE usar optimistic updates (atualizar estado React imediatamente, persistir em background).
6. O `ExpenseContext` DEVE reverter o estado otimista (rollback) ao estado anterior à chamada quando a persistência falha.
7. O `ExpenseContext` DEVE tratar erros de persistência exibindo notificação ao usuário.
8. Dado o `ExpenseProvider` montado, quando a aplicação inicia, então carrega dados via `adapter.loadAll()`.
9. Dado uma nova despesa, quando `addExpense()` é chamado, então o estado React é atualizado imediatamente e a despesa é persistida via `expenseRepo.save()`; se a persistência falhar, o estado é revertido ao anterior e uma notificação de erro é exibida.
10. Dado falha na persistência, quando `addExpense()` falha, então uma notificação de erro é exibida e o estado React é revertido ao estado anterior à chamada.

### Requirement 7: Environment Variable Configuration

**User Story:**

Como desenvolvedor, quero configurar variáveis de ambiente para selecionar o backend de armazenamento e configurar o Firebase.

1. O sistema DEVE ler a variável `VITE_STORAGE_BACKEND` para selecionar o backend.
2. Quando `VITE_STORAGE_BACKEND = "firebase"`, o sistema DEVE ler variáveis adicionais: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
3. O sistema DEVE prover um arquivo `.env.example` com todas as variáveis documentadas.
4. Dado `.env` com `VITE_STORAGE_BACKEND=firebase` e credenciais válidas, quando a aplicação inicia, então o `FirebaseAdapter` é inicializado com as credenciais.
5. Dado `.env` com `VITE_STORAGE_BACKEND=local`, quando a aplicação inicia, então o `LocalStorageAdapter` é usado e nenhuma configuração Firebase é necessária.

### Requirement 8: Data Migration Utility

**User Story:**

Como desenvolvedor, quero uma função utilitária para migrar dados do localStorage para o Firebase preservando a integridade.

1. O sistema DEVE prover uma função `migrateFromLocalToFirebase()` que transfere todos os dados do localStorage para o Firebase.
2. A migração DEVE preservar a integridade dos dados (mesmas entidades, mesmos IDs, mesmos relacionamentos).
3. A migração DEVE usar operações em lote (batch) para eficiência.
4. Dado dados no localStorage, quando `migrateFromLocalToFirebase()` é executada, então `firebaseAdapter.loadAll()` retorna os mesmos dados que `localAdapter.loadAll()`.
5. Dado 50 budgets e 200 expenses no localStorage, quando a migração é executada, então todos aparecem no Firestore.

### Requirement 9: Export and Import Functionality

**User Story:**

Como usuário, quero continuar exportando e importando dados sem mudanças no comportamento atual.

1. A funcionalidade de exportar dados (download JSON) DEVE continuar funcionando sem mudanças de comportamento.
2. A funcionalidade de importar dados (upload JSON) DEVE validar a estrutura e persistir via `adapter.saveAll()`.
3. A importação DEVE validar que `budgets` e `expenses` são arrays válidos antes de salvar.
4. Dado dados na aplicação, quando `exportData()` é chamado, então um arquivo JSON é baixado com a estrutura `StorageData`.
5. Dado um arquivo JSON válido, quando `importData(file)` é chamado, então os dados são carregados e persistidos via `adapter.saveAll()`.
6. Dado um arquivo JSON sem a propriedade `budgets`, quando `importData(file)` é chamado, então a operação é rejeitada com erro "Formato de arquivo inválido".

### Requirement 10: Referential Integrity

**User Story:**

Como desenvolvedor, quero garantir a integridade referencial dos dados em todas as operações.

1. Após deletar um budget, todas as expenses com aquele `budgetId` DEVE ser removidas.
2. O `activeBudgetId` DEVE ser sempre `null` ou referenciar um budget existente na lista.
3. Quando o budget ativo é deletado e existem múltiplos outros budgets, o sistema DEVE selecionar o budget mais recentemente criado/usado como novo ativo.
4. Dado um budget "abc" com 5 expenses associadas, quando `deleteBudget("abc")` é chamado, então nenhuma expense com `budgetId = "abc"` permanece no storage.
5. Dado `activeBudgetId = "abc"` e budget "abc" deletado, quando a operação completa, então `activeBudgetId` é atualizado para o budget mais recentemente criado/usado ou `null` se nenhum existir.

### Requirement 11: Data Validation

**User Story:**

Como desenvolvedor, quero validar os dados de budgets e expenses para garantir consistência.

1. Todo budget DEVE ter `totalAmount > 0` e `endDate > startDate`.
2. Toda expense DEVE ter `amount > 0`, `description` não vazia, e `date` válida.
3. CategoryLimits dentro de um mesmo budget DEVE ter categorias únicas.
4. Dado um budget com `totalAmount = 0`, quando validado, então a validação falha.
5. Dado um budget com `endDate < startDate`, quando validado, então a validação falha.
6. Dado duas CategoryLimits com mesma categoria no mesmo budget, quando verificada, então a propriedade de unicidade falha.

### Requirement 12: ID Uniqueness

**User Story:**

Como desenvolvedor, quero garantir unicidade de IDs para budgets e expenses.

1. Todos os IDs de budgets DEVE ser únicos.
2. Todos os IDs de expenses DEVE ser únicos.
3. O sistema DEVE usar `nanoid` para geração de IDs em vez de `Date.now().toString()`.
4. Dado 1000 budgets gerados, quando verificados, então todos os IDs são únicos.
5. Dado 1000 expenses gerados, quando verificados, então todos os IDs são únicos.

### Requirement 13: Storage Consistency

**User Story:**

Como desenvolvedor, quero garantir que o estado do storage reflita o estado do React após operações de escrita.

1. Após qualquer operação de escrita completar (Promise resolvida), o estado do storage DEVE refletir o estado do React.
2. Dado um expense salvo, quando `saveExpense()` resolve, então `loadExpenses()` inclui o expense.
3. Dado um budget deletado, quando `deleteBudget()` resolve, então `loadBudgets()` exclui o budget.

### Requirement 14: Adapter Interchangeability

**User Story:**

Como desenvolvedor, quero garantir que qualquer implementação de StorageAdapter produza resultados equivalentes.

1. Qualquer implementação de `StorageAdapter` DEVE produzir resultados equivalentes para as mesmas operações.
2. Dado os mesmos dados iniciais, quando `LocalStorageAdapter` e `FirebaseAdapter` executam a mesma sequência de operações, então ambos produzem o mesmo estado final.

### Requirement 15: Error Handling

**User Story:**

Como desenvolvedor, quero tratamento de erros robusto para falhas de persistência e dados corrompidos.

1. Erros de persistência (Firebase) DEVE ser capturados e exibidos ao usuário via toast notification.
2. Dados corrompidos no localStorage DEVE resultar em estado limpo sem crashar.
3. Arquivos de importação inválidos DEVE ser rejeitados com mensagem clara.
4. Dado uma falha de rede no Firebase, quando `saveExpense()` rejeita, então um toast de erro é exibido e o estado React permanece atualizado.
5. Dado JSON corrompido no localStorage, quando `loadAll()` é chamado, então retorna dados vazios sem crashar.

### Requirement 16: Performance Optimization

**User Story:**

Como desenvolvedor, quero otimizar as operações de escrita ao Firestore para evitar custos excessivos.

1. Escritas ao Firestore DEVEM ser debounced (300-500ms) para evitar custos excessivos.
2. Chamadas que abranjam múltiplas janelas de debounce são permitidas e produzem múltiplas escritas (uma por janela).
3. Migração de dados DEVE usar `writeBatch` para operações em lote.
4. Dado 10 chamadas rápidas a `saveExpense()` dentro de uma única janela de debounce de 500ms, quando executadas, então no máximo 1 escrita real ao Firestore ocorre.
5. Dado chamadas que abranjam múltiplas janelas de debounce, quando executadas, então uma escrita por janela é permitida.
6. Dado migração de 200 expenses, quando executada, então usa `writeBatch` para eficiência.

### Requirement 17: Security

**User Story:**

Como desenvolvedor, quero garantir segurança no acesso aos dados armazenados no Firebase.

1. Regras de segurança do Firestore DEVEM garantir que apenas usuários autenticados acessem seus próprios dados.
2. Dados importados DEVEM ser validados antes de salvar, independentemente de existir ou não dados de importação presentes (invariante incondicional).
3. Dado um usuário não autenticado, quando tenta ler `budgets`, então a operação é negada pelas security rules.
4. Dado um arquivo de importação com dados maliciosos, quando processado, então a validação rejeita dados inválidos.
5. Dado que nenhum dado de importação está presente, quando o sistema valida dados antes de salvar, então a validação ainda é exigida como invariante incondicional.

### Requirement 18: Project Structure and Dependencies

**User Story:**

Como desenvolvedor, quero adicionar a dependência do Firebase e estruturar os arquivos da camada de storage.

1. O sistema DEVE adicionar a dependência `firebase` ao projeto.
2. O sistema DEVE criar o diretório `client/src/storage/` com os arquivos: `StorageAdapter.ts`, `LocalStorageAdapter.ts`, `FirebaseAdapter.ts`, `StorageFactory.ts`, `BudgetRepository.ts`, `ExpenseRepository.ts`, `types.ts`.
3. O `ExpenseContext.tsx` DEVE ser modificado para usar os repositories em vez de localStorage direto.
4. Dado o `package.json`, quando a feature é implementada, então `firebase` está listado em `dependencies`.
5. Dado a implementação completa, quando verificados, então todos os arquivos em `client/src/storage/` existem e exportam as interfaces/classes corretas.
6. Dado o `ExpenseContext.tsx`, quando analisado, então não contém referências diretas a `localStorage`.
