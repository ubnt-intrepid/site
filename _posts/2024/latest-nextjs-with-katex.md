---
title: Next.js の更新 + KaTeX の有効化
published: 2024-11-23T12:49:06+09:00
categories: [ "general" ]
tags: [ "blog" ]
---

ずいぶんと放置してしまっていたので、Next.js を最新版にアップデートするついでに App Router に切り替え、ついでに $\KaTeX$ で数式入力が出来るように対応した。

$$
\begin{gathered}
    \dot{x}(t) = f(t, x, t) \\
    J = \varphi(t_f, x(t_f)) + \int_{t_0}^{t_f} L(t, x(t), u(t)) \, dt
\end{gathered}
$$

…まぁ変えたところで書くネタがそこまで無いのですが。

```math
x(t) = \sin \omega t
```
