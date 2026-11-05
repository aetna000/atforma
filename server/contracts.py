"""Strict contracts for the local agent boundary; no executable config accepted."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictFloat, StrictInt, StrictStr, field_validator, model_validator

class Strict(BaseModel):
    model_config=ConfigDict(extra='forbid')

class Position(Strict):
    x:float=Field(ge=-100000,le=100000,allow_inf_nan=False)
    y:float=Field(ge=-100000,le=100000,allow_inf_nan=False)

class Configuration(Strict):
    region:str=Field(default='To be selected',max_length=100)
    classification:Literal['Public','Internal','Confidential']='Internal'
    timeout:int=Field(default=5000,ge=100,le=60000)

class Measure(Strict):
    label:str=Field(min_length=1,max_length=150)
    path:str=Field(pattern=r'^[A-Za-z_][A-Za-z0-9_.]{0,79}$')
    op:Literal['>=','<=','==']
    target:StrictBool|StrictInt|StrictFloat|StrictStr
    @field_validator('target')
    @classmethod
    def short(cls,value):
        if isinstance(value,str) and len(value)>100:raise ValueError('Target too long')
        return value

class Data(Strict):
    label:str=Field(min_length=1,max_length=150)
    kind:Literal['source','predict','agent','guard','output','tool','resource','stream','history','features','train','registry','monitor','note']
    provider:Literal['aws','azure','gcp','ibm','tools']
    description:str=Field(default='',max_length=1000)
    config:Configuration=Field(default_factory=Configuration)
    inputPosition:Literal['left','right','top','bottom']='left'
    outputPosition:Literal['left','right','top','bottom']='right'
    origin:str=Field(default='proposed',max_length=100)
    poc:bool=False
    role:Literal['data','ingest','index','llm','guard','human','app','output','model','monitor']|None=None
    measures:list[Measure]|None=Field(default=None,max_length=10)
    service:str|None=Field(default=None,max_length=150)
    category:str|None=Field(default=None,max_length=150)

class Node(Strict):
    id:str=Field(min_length=1,max_length=100)
    type:Literal['resource']='resource'
    position:Position
    data:Data

class Edge(Strict):
    id:str=Field(min_length=1,max_length=150)
    source:str=Field(max_length=100)
    target:str=Field(max_length=100)
    type:Literal['smoothstep']='smoothstep'
    label:str=Field(default='data',max_length=150)

class Project(Strict):
    version:Literal[1]=1
    revision:int=Field(ge=1)
    name:str=Field(min_length=1,max_length=200)
    provider:Literal['aws','azure','gcp','ibm','tools']='tools'
    domain:Literal['maintenance','churn']|None=None
    requirements:str=Field(default='',max_length=8000)
    nodes:list[Node]=Field(max_length=200)
    edges:list[Edge]=Field(max_length=600)
    @model_validator(mode='after')
    def integrity(self):
        ids=[n.id for n in self.nodes]
        if len(ids)!=len(set(ids)):raise ValueError('Duplicate block IDs')
        wires=[e.id for e in self.edges]
        if len(wires)!=len(set(wires)):raise ValueError('Duplicate wire IDs')
        if any(e.source not in ids or e.target not in ids or e.source==e.target for e in self.edges):raise ValueError('Invalid wire endpoint')
        return self

class Proposal(Strict):
    baseRevision:int=Field(ge=1)
    title:str=Field(max_length=200)
    body:str=Field(max_length=4000)
    next:Project

class ArchitectResponse(Strict):
    message:str=Field(min_length=1,max_length=16000)
    phase:Literal['Discovery','Architecture','Cost Analysis','Architecture Review']='Discovery'
    proposal:Proposal|None=None

class Message(Strict):
    role:Literal['user','assistant']
    text:str=Field(max_length=12000)

class ContextItem(Strict):
    type:Literal['requirement','assumption','question','decision','discovery']
    id:str=Field(min_length=1,max_length=60)
    text:str=Field(max_length=1000)

class ChatRequest(Strict):
    message:str=Field(min_length=1,max_length=8000)
    provider:Literal['claude-code','codex','copilot','gemini-cli','anthropic','openai','gemini-api','xai','bedrock']='claude-code'
    model:str=Field(min_length=1,max_length=150)
    effort:Literal['none','minimal','low','medium','high','xhigh','max','ultra']|None=None
    project:Project
    stage:Literal['discover','design','review','estimate','deploy','build']='discover'
    context:list[ContextItem]=Field(default_factory=list,max_length=300)
    history:list[Message]=Field(default_factory=list,max_length=16)
    @field_validator('message','model')
    @classmethod
    def not_blank(cls,value):
        if not value.strip():raise ValueError('Must not be blank')
        return value
