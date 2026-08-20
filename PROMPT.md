Analise as métricas abaixo dos meus históricos do Claude Code com um objetivo principal: **reduzir o consumo de tokens por sessão sem prejudicar significativamente a qualidade do trabalho**.

Quero que você identifique:

1. **Maiores fontes de desperdício** — ferramentas, padrões de uso, sessões ou comportamentos que parecem consumir contexto/tokens desnecessariamente.
2. **Uso de subagents** — avalie quando os Agents parecem úteis versus quando poderiam ser substituídos por uma abordagem mais simples. Dê atenção especial aos prompts enviados aos agents e à possível multiplicação de contexto.
3. **Sessões anormalmente pesadas** — encontre outliers e explique, quando os dados permitirem, o que provavelmente causou o consumo elevado.
4. **Chamadas de ferramentas potencialmente redundantes** — excesso de Read, Bash, WebSearch, MCPs, releituras, buscas repetidas, exploração excessiva etc.
5. **Mudanças concretas** — sugira alterações em CLAUDE.md, instruções, uso de agents, MCPs ou workflow que possam reduzir o consumo.

Priorize os achados por **impacto potencial na redução de tokens**.

Para cada problema relevante, responda no formato:

* **Problema**
* **Evidência nos dados**
* **Por que pode estar gastando tokens**
* **Mudança recomendada**
* **Impacto esperado:** alto / médio / baixo

Evite recomendações genéricas. Baseie cada conclusão nas métricas fornecidas e diferencie claramente **fato observado** de **hipótese**.

No final, entregue as **5 mudanças que provavelmente terão maior impacto** no meu consumo de tokens.

Métricas:
[COLE A SAÍDA DO ANALISADOR AQUI]
