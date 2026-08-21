# K-means segmentation of the full prospect list -> clear target tiers (A-D).
# Reads data/payfinia_bank_prospects.csv, assigns a segment to every bank,
# writes the clustered CSV + web/src/prospects.json for the React app.
import os, numpy as np, pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

HERE=os.path.dirname(os.path.abspath(__file__))
df=pd.read_csv(os.path.join(HERE,"data","payfinia_bank_prospects.csv"))
df=df[(df.assets_musd>0)&(df.offices>0)].copy()

# features: size + branch network (standardized). Value/ROI track size, so this
# yields clean value-ordered target tiers.
df["log_assets"]=np.log10(df.assets_musd*1000)
df["log_offices"]=np.log1p(df.offices)
X=StandardScaler().fit_transform(df[["log_assets","log_offices"]].values)

km=KMeans(n_clusters=4,n_init=25,random_state=42).fit(X)
df["cluster"]=km.labels_
print("silhouette (k=4):",round(silhouette_score(X,km.labels_),3))

# order clusters by median $ opportunity -> A (target first) ... D (low)
order=df.groupby("cluster").est_net_benefit.median().sort_values(ascending=False).index.tolist()
names=["A — Target first","B — Strong","C — Moderate","D — Low priority"]
seg={cl:names[i] for i,cl in enumerate(order)}
srank={cl:i+1 for i,cl in enumerate(order)}
df["segment"]=df.cluster.map(seg); df["segment_rank"]=df.cluster.map(srank)
df=df.sort_values(["segment_rank","est_net_benefit"],ascending=[True,False]).reset_index(drop=True)

df.to_csv(os.path.join(HERE,"data","payfinia_bank_prospects.csv"),index=False)
cols=["priority_rank","name","state","city","tier","segment","segment_rank","assets_musd","offices","est_net_benefit","roi_pct"]
os.makedirs(os.path.join(HERE,"web","src"),exist_ok=True)
df[cols].to_json(os.path.join(HERE,"web","src","prospects.json"),orient="records")

print("\nTARGET SEGMENTS")
g=df.groupby(["segment_rank","segment"]).agg(banks=("name","size"),median_assets_M=("assets_musd","median"),
    total_opp=("est_net_benefit","sum"),avg_roi=("roi_pct","mean")).reset_index().sort_values("segment_rank")
for _,r in g.iterrows():
    print(f"  {r.segment:<20} {int(r.banks):>4} banks · median ${r.median_assets_M:,.0f}M · "
          f"total ${r.total_opp:,.0f}/yr · avg ROI {r.avg_roi:.0f}%")
